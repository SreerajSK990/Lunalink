import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ApiPlayer, ApiTrack } from "../protocol/index.js";
import { lavalinkInfo, nodeLinkInfo, stats } from "./fixtures.js";
import { ServerSocket } from "./ServerSocket.js";

/**
 * Mock node settings.
 */
export interface MockNodeOptions {
  /** Which server to imitate. Defaults to `lavalink`. */
  kind?: "lavalink" | "nodelink";
  /** Password. Defaults to `youshallnotpass`. */
  password?: string;
  /** Server plugins reported by `/v4/info`. */
  plugins?: { name: string; version: string }[];
}

/**
 * One REST request the mock received.
 */
export interface RecordedRequest {
  /** HTTP method. */
  method: string;
  /** Path without the query. */
  path: string;
  /** Query parameters. */
  query: URLSearchParams;
  /** Parsed JSON body. */
  body: unknown;
}

/**
 * A custom REST route. Return `undefined` to fall back to the built-in routes.
 */
export type MockRoute = (
  request: RecordedRequest,
) => { status: number; body?: unknown } | undefined;

/**
 * A fake Lavalink or NodeLink server on `127.0.0.1` for tests: the info, stats, load tracks,
 * player and session routes, the WebSocket with `ready`, resuming, and helpers to send events.
 *
 * @example
 * ```ts
 * const node = await new MockNode().start();
 * node.loadTracks = () => ({ loadType: "search", data: [track("a")] });
 * // ... connect Lunalink to 127.0.0.1:node.port ...
 * node.sendTrackStart(guildId, track("a"));
 * await node.stop();
 * ```
 */
export class MockNode {
  /** Server kind. */
  readonly kind: "lavalink" | "nodelink";
  /** Password. */
  readonly password: string;
  /** Every REST request, in order. */
  readonly requests: RecordedRequest[] = [];
  /** Open WebSockets. */
  readonly sockets: Set<ServerSocket> = new Set();
  /** Headers of every WebSocket upgrade. */
  readonly upgrades: Record<string, string | string[] | undefined>[] = [];
  /** Players, by guild id. */
  readonly players: Map<string, ApiPlayer> = new Map();
  /** Answers `/v4/loadtracks`. */
  loadTracks: (identifier: string) => unknown = emptyLoadResult;
  /** Custom routes, tried first. */
  routes: MockRoute[] = [];
  /** Current session id. */
  sessionId = "session-1";
  /** Whether the session can be resumed. Set by `PATCH /v4/sessions/{id}`. */
  resumable = false;
  #sessionCounter = 1;
  readonly #http: Server;
  readonly #plugins: { name: string; version: string }[];

  /**
   * Creates the mock. Call `start()` to listen.
   *
   * @param options - Kind, password and plugins.
   */
  constructor(options: MockNodeOptions = {}) {
    this.kind = options.kind ?? "lavalink";
    this.password = options.password ?? "youshallnotpass";
    this.#plugins = options.plugins ?? [];
    this.#http = createServer((req, res) => {
      void this.#handle(req, res);
    });
    this.#http.on("upgrade", (req: IncomingMessage, socket) => {
      this.upgrades.push(req.headers);
      if (req.headers["authorization"] !== this.password) {
        socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return;
      }
      const ws = ServerSocket.accept(req, socket);
      if (ws) this.#onSocket(ws, req);
    });
  }

  /**
   * The port it listens on.
   *
   * @returns The port.
   */
  get port(): number {
    return (this.#http.address() as AddressInfo).port;
  }

  /**
   * Starts listening on a free port.
   *
   * @returns The mock.
   */
  async start(): Promise<this> {
    await new Promise<void>((resolve) => this.#http.listen(0, "127.0.0.1", resolve));
    return this;
  }

  /**
   * Stops listening and drops every connection.
   */
  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.terminate();
    await new Promise<void>((resolve) => {
      this.#http.close(() => {
        resolve();
      });
      this.#http.closeAllConnections();
    });
  }

  /**
   * Sends a message to every WebSocket.
   *
   * @param payload - The message.
   */
  send(payload: unknown): void {
    const text = JSON.stringify(payload);
    for (const socket of this.sockets) socket.send(text);
  }

  /**
   * Sends an event.
   *
   * @param guildId - Guild id.
   * @param type - Event type, for example `TrackStartEvent`.
   * @param fields - Other fields.
   */
  sendEvent(guildId: string, type: string, fields: Record<string, unknown> = {}): void {
    this.send({ op: "event", type, guildId, ...fields });
  }

  /**
   * Sends `TrackStartEvent`.
   *
   * @param guildId - Guild id.
   * @param track - The track.
   */
  sendTrackStart(guildId: string, track: ApiTrack): void {
    this.sendEvent(guildId, "TrackStartEvent", { track });
  }

  /**
   * Sends `TrackEndEvent`.
   *
   * @param guildId - Guild id.
   * @param track - The track.
   * @param reason - End reason. Defaults to `finished`.
   */
  sendTrackEnd(guildId: string, track: ApiTrack, reason = "finished"): void {
    this.sendEvent(guildId, "TrackEndEvent", { track, reason });
  }

  /**
   * Sends a `playerUpdate`.
   *
   * @param guildId - Guild id.
   * @param position - Position in milliseconds.
   * @param connected - Whether voice is connected.
   */
  sendPlayerUpdate(guildId: string, position: number, connected = true): void {
    this.send({
      op: "playerUpdate",
      guildId,
      state: { time: Date.now(), position, connected, ping: 10 },
    });
  }

  /**
   * Drops every WebSocket. `1006` drops without a close frame, like a crash.
   *
   * @param code - Close code.
   */
  dropConnections(code = 1006): void {
    for (const socket of this.sockets) {
      if (code === 1006) socket.terminate();
      else socket.close(code);
    }
  }

  /**
   * Lists the requests with a method whose path contains a string.
   *
   * @param method - HTTP method.
   * @param pathPart - Part of the path.
   * @returns Matching requests.
   */
  requestsTo(method: string, pathPart: string): RecordedRequest[] {
    return this.requests.filter(
      (request) => request.method === method && request.path.includes(pathPart),
    );
  }

  #onSocket(ws: ServerSocket, req: IncomingMessage): void {
    this.sockets.add(ws);
    ws.onClose = () => {
      this.sockets.delete(ws);
    };
    const requested = req.headers["session-id"];
    const resumed = this.resumable && typeof requested === "string" && requested === this.sessionId;
    if (!resumed) {
      this.#sessionCounter++;
      this.sessionId = `session-${String(this.#sessionCounter)}`;
      this.players.clear();
    }
    ws.send(JSON.stringify({ op: "ready", resumed, sessionId: this.sessionId }));
    ws.send(JSON.stringify({ op: "stats", ...stats(this.kind, this.players.size) }));
    if (resumed) {
      for (const player of this.players.values())
        this.sendPlayerUpdate(player.guildId, player.state.position);
    }
  }

  async #handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    const request: RecordedRequest = {
      method: req.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      body: text ? (JSON.parse(text) as unknown) : undefined,
    };
    this.requests.push(request);
    if (this.kind === "nodelink") res.setHeader("IamNodelink", "true");
    if (req.headers["authorization"] !== this.password) {
      reply(res, 401, {
        status: 401,
        error: "Unauthorized",
        message: "Unauthorized",
        path: url.pathname,
      });
      return;
    }
    for (const route of this.routes) {
      const result = route(request);
      if (result) {
        reply(res, result.status, result.body);
        return;
      }
    }
    const response = this.#defaultRoute(request);
    reply(res, response.status, response.body);
  }

  #defaultRoute(request: RecordedRequest): { status: number; body?: unknown } {
    const { method, path } = request;
    if (path === "/v4/info") {
      return {
        status: 200,
        body: this.kind === "lavalink" ? lavalinkInfo(this.#plugins) : nodeLinkInfo(),
      };
    }
    if (path === "/v4/stats") return { status: 200, body: stats(this.kind, this.players.size) };
    if (path === "/version") return { status: 200, body: "4.2.2" };
    if (path === "/v4/loadtracks") {
      return { status: 200, body: this.loadTracks(request.query.get("identifier") ?? "") };
    }
    const playerMatch = /^\/v4\/sessions\/([^/]+)\/players\/(\d+)$/.exec(path);
    if (playerMatch)
      return this.#playerRoute(method, playerMatch[1] ?? "", playerMatch[2] ?? "", request.body);
    if (/^\/v4\/sessions\/[^/]+\/players$/.test(path))
      return { status: 200, body: [...this.players.values()] };
    if (/^\/v4\/sessions\/[^/]+$/.test(path) && method === "PATCH") {
      const body = request.body as { resuming?: boolean; timeout?: number };
      if (body.resuming !== undefined) this.resumable = body.resuming;
      return { status: 200, body: { resuming: this.resumable, timeout: body.timeout ?? 60 } };
    }
    return { status: 404, body: { status: 404, error: "Not Found", message: "Not found", path } };
  }

  #playerRoute(
    method: string,
    sessionId: string,
    guildId: string,
    body: unknown,
  ): { status: number; body?: unknown } {
    if (sessionId !== this.sessionId) {
      return { status: 404, body: { status: 404, message: "Session not found", path: "" } };
    }
    if (method === "DELETE") {
      this.players.delete(guildId);
      return { status: 204 };
    }
    const player = this.players.get(guildId) ?? emptyPlayer(guildId);
    if (method === "PATCH") applyUpdate(player, body as Record<string, unknown>);
    this.players.set(guildId, player);
    return { status: 200, body: player };
  }
}

/**
 * The default `/v4/loadtracks` answer: nothing found.
 *
 * @returns An empty load result.
 */
function emptyLoadResult(): unknown {
  return { loadType: "empty", data: null };
}

function emptyPlayer(guildId: string): ApiPlayer {
  return {
    guildId,
    track: null,
    volume: 100,
    paused: false,
    state: { time: Date.now(), position: 0, connected: false, ping: -1 },
    voice: { token: "", endpoint: "", sessionId: "" },
    filters: {},
  };
}

function applyUpdate(player: ApiPlayer, body: Record<string, unknown>): void {
  const track = body["track"] as { encoded?: string | null } | undefined;
  if (track && "encoded" in track) {
    player.track = track.encoded ? ({ encoded: track.encoded } as ApiTrack) : null;
    player.state.position = 0;
  }
  if (typeof body["position"] === "number") player.state.position = body["position"];
  if (typeof body["volume"] === "number") player.volume = body["volume"];
  if (typeof body["paused"] === "boolean") player.paused = body["paused"];
  if (body["filters"]) player.filters = body["filters"];
  if (body["voice"]) {
    player.voice = body["voice"] as ApiPlayer["voice"];
    player.state.connected = true;
  }
}

function reply(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res
    .writeHead(status, {
      "content-type": typeof body === "string" ? "text/plain" : "application/json",
    })
    .end(text);
}
