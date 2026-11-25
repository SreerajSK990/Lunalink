import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import type { ApiPlayer, ApiTrack } from "../../src/protocol/index.js";
import { lavalinkInfo, nodeLinkInfo, stats } from "./fixtures.js";

export interface MockServerOptions {
  kind?: "lavalink" | "nodelink";
  password?: string;
  plugins?: { name: string; version: string }[];
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

type RouteHandler = (request: RecordedRequest) => { status: number; body?: unknown } | undefined;

export class MockServer {
  readonly kind: "lavalink" | "nodelink";
  readonly password: string;
  readonly requests: RecordedRequest[] = [];
  readonly sockets = new Set<WebSocket>();
  readonly upgrades: Record<string, string | string[] | undefined>[] = [];
  readonly players = new Map<string, ApiPlayer>();
  loadTracks: (identifier: string) => unknown = () => ({ loadType: "empty", data: null });
  routes: RouteHandler[] = [];
  sessionId = "session-1";
  resumable = false;
  #sessionCounter = 1;
  #http: Server;
  #ws: WebSocketServer;
  #plugins: { name: string; version: string }[];

  constructor(options: MockServerOptions = {}) {
    this.kind = options.kind ?? "lavalink";
    this.password = options.password ?? "youshallnotpass";
    this.#plugins = options.plugins ?? [];
    this.#http = createServer((req, res) => {
      void this.#handle(req, res);
    });
    this.#ws = new WebSocketServer({ noServer: true });
    this.#http.on("upgrade", (req, socket, head) => {
      this.upgrades.push(req.headers);
      if (req.headers["authorization"] !== this.password) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      this.#ws.handleUpgrade(req, socket, head, (ws) => {
        this.#onSocket(ws, req);
      });
    });
  }

  get port(): number {
    return (this.#http.address() as AddressInfo).port;
  }

  async start(): Promise<this> {
    await new Promise<void>((resolve) => this.#http.listen(0, "127.0.0.1", resolve));
    return this;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.terminate();
    this.#ws.close();
    await new Promise<void>((resolve) => {
      this.#http.close(() => {
        resolve();
      });
      this.#http.closeAllConnections();
    });
  }

  send(payload: unknown): void {
    const text = JSON.stringify(payload);
    for (const socket of this.sockets) socket.send(text);
  }

  sendEvent(guildId: string, type: string, fields: Record<string, unknown> = {}): void {
    this.send({ op: "event", type, guildId, ...fields });
  }

  sendTrackStart(guildId: string, track: ApiTrack): void {
    this.sendEvent(guildId, "TrackStartEvent", { track });
  }

  sendTrackEnd(guildId: string, track: ApiTrack, reason = "finished"): void {
    this.sendEvent(guildId, "TrackEndEvent", { track, reason });
  }

  sendPlayerUpdate(guildId: string, position: number, connected = true): void {
    this.send({
      op: "playerUpdate",
      guildId,
      state: { time: Date.now(), position, connected, ping: 10 },
    });
  }

  dropConnections(code = 1006): void {
    for (const socket of this.sockets) {
      if (code === 1006) socket.terminate();
      else socket.close(code);
    }
  }

  requestsTo(method: string, pathPart: string): RecordedRequest[] {
    return this.requests.filter(
      (request) => request.method === method && request.path.includes(pathPart),
    );
  }

  #onSocket(ws: WebSocket, req: IncomingMessage): void {
    this.sockets.add(ws);
    ws.on("close", () => this.sockets.delete(ws));
    const requested = req.headers["session-id"];
    const resumed = this.resumable && typeof requested === "string" && requested === this.sessionId;
    if (!resumed) {
      this.#sessionCounter++;
      this.sessionId = `session-${this.#sessionCounter}`;
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
      return this.#playerRoute(method, playerMatch[1]!, playerMatch[2]!, request.body);
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
