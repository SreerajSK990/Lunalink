import type { Capability } from "../capabilities/Capability.js";
import type { CapabilityRule } from "../capabilities/CapabilityRule.js";
import { CapabilitySet } from "../capabilities/CapabilitySet.js";
import { resolveCapabilities } from "../capabilities/resolveCapabilities.js";
import { detectKind } from "../drivers/detectKind.js";
import { driverFor } from "../drivers/index.js";
import type { NodeDriver, NodeInfo, NodeKind, NodeStats } from "../drivers/types.js";
import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import { RestError } from "../errors/RestError.js";
import type { DebugEvent } from "../events/DebugEvent.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import { HttpClient, type FetchLike } from "../transport/http/HttpClient.js";
import { Routes } from "../transport/http/routes.js";
import type { SocketFactory } from "../transport/ws/SocketFactory.js";
import { TimerRegistry } from "../utils/TimerRegistry.js";
import { ConnectionMachine } from "./ConnectionMachine.js";
import { handleNodeMessage } from "./handleNodeMessage.js";
import type { NodeEvents } from "./NodeEvents.js";
import type { ResolvedNodeOptions } from "./NodeOptions.js";
import { NodeRest } from "./NodeRest.js";
import type { NodeState } from "./NodeState.js";
import { restBaseUrl, socketUrl } from "./resolveNodeOptions.js";

/**
 * Things a node needs from the Lunalink instance that owns it.
 */
export interface NodeRuntime {
  /** Returns the bot's user id, or `undefined` before the bot is logged in. */
  userId(): string | undefined;
  /** `Client-Name` header value. */
  clientName: string;
  /** Opens WebSockets. */
  socketFactory: SocketFactory;
  /** Custom `fetch`, if any. */
  fetch: FetchLike | undefined;
  /** Capability rules registered by plugins. */
  capabilityRules(): readonly CapabilityRule[];
  /** Receives debug messages. */
  debug(event: DebugEvent): void;
}

/**
 * One Lavalink or NodeLink server. Lunalink creates these from the `nodes` option; you mostly
 * use them to read stats or capabilities, or to call `node.rest` directly.
 *
 * @example
 * ```ts
 * const node = lunalink.nodes.get("main");
 * console.log(node?.kind, node?.stats?.playingPlayers, node?.capabilities.list());
 * ```
 */
export class Node {
  /** Unique name. */
  readonly id: string;
  /** Settings with defaults applied. */
  readonly options: ResolvedNodeOptions;
  /** Node events. Most bots listen on the Lunalink instance instead, which relays these. */
  readonly events: TypedEmitter<NodeEvents> = new TypedEmitter<NodeEvents>();
  /** Typed REST calls for this node. */
  readonly rest: NodeRest;
  /** The node's HTTP client, for advanced use. */
  readonly http: HttpClient;

  readonly #runtime: NodeRuntime;
  readonly #timers = new TimerRegistry();
  readonly #machine: ConnectionMachine;
  #state: NodeState = "idle";
  #driver: NodeDriver;
  #info: NodeInfo | null = null;
  #stats: NodeStats | null = null;
  #capabilities: CapabilitySet;
  #sessionId: string | null;
  #readyOnce: Promise<void> | null = null;

  /**
   * Creates a node. Call {@link Node.connect} to start it.
   *
   * @param options - Resolved settings.
   * @param runtime - Services from the owning Lunalink instance.
   */
  constructor(options: ResolvedNodeOptions, runtime: NodeRuntime) {
    this.id = options.id;
    this.options = options;
    this.#runtime = runtime;
    this.#sessionId = options.sessionId ?? null;
    this.#driver = driverFor(options.type === "auto" ? "lavalink" : options.type);
    this.#capabilities = new CapabilitySet(this.id, options.assumeCapabilities);
    this.http = new HttpClient({
      baseUrl: restBaseUrl(options),
      password: options.password,
      clientName: runtime.clientName,
      timeoutMs: options.requestTimeoutMs,
      maxRateLimitRetries: 2,
      maxRetryAfterMs: 5_000,
      headers: options.headers,
      ...(runtime.fetch ? { fetch: runtime.fetch } : {}),
    });
    this.rest = new NodeRest(this.http, () => this.requireSessionId());
    this.#machine = new ConnectionMachine(
      {
        url: socketUrl(options, Routes.websocket()),
        socketFactory: runtime.socketFactory,
        reconnect: options.reconnect,
        silenceTimeoutMs: options.silenceTimeoutMs,
        timers: this.#timers,
      },
      {
        preflight: (signal) => this.#preflight(signal),
        headers: () => this.#upgradeHeaders(),
        onOpen: () => {
          this.#debug("info", "WebSocket open, waiting for ready");
        },
        onMessage: (data) => {
          handleNodeMessage(this, data, {
            onReady: (sessionId) => {
              this.#sessionId = sessionId;
              this.#state = "ready";
              this.#machine.markHealthy();
            },
            onStats: (stats) => {
              this.#stats = stats;
            },
            debug: (level, message, extra) => {
              this.#debug(level, message, extra);
            },
          });
        },
        onClose: (code, reason) => {
          this.#state = "reconnecting";
          this.#debug("warn", `WebSocket closed (${code}${reason ? `: ${reason}` : ""})`);
          this.events.emit("disconnect", code, reason);
        },
        onRetry: (attempt, delayMs, error) => {
          this.#state =
            this.#state === "connecting" && attempt === 1 ? "connecting" : "reconnecting";
          this.#debug("warn", `Retrying in ${delayMs} ms (attempt ${attempt})`, {
            error: describe(error),
          });
          this.events.emit("reconnecting", attempt, delayMs, error);
        },
        onGiveUp: (error) => {
          this.#state = "disconnected";
          this.#debug("error", "Stopped reconnecting", { error: describe(error) });
          this.events.emit("error", error);
          this.events.emit("giveUp", error);
        },
        isFatal: (error) => isFatal(error),
      },
    );
  }

  /**
   * Server kind. Until the first connect it's the configured `type`, or `lavalink`.
   *
   * @returns `lavalink` or `nodelink`.
   */
  get kind(): NodeKind {
    return this.#driver.kind;
  }

  /**
   * The driver translating this server's wire format.
   *
   * @returns The driver.
   */
  get driver(): NodeDriver {
    return this.#driver;
  }

  /**
   * Connection state.
   *
   * @returns The state.
   */
  get state(): NodeState {
    return this.#state;
  }

  /**
   * Whether the node is ready for players.
   *
   * @returns `true` when the state is `ready`.
   */
  get connected(): boolean {
    return this.#state === "ready";
  }

  /**
   * Server info from the last successful connect.
   *
   * @returns Info, or `null` before the first connect.
   */
  get info(): NodeInfo | null {
    return this.#info;
  }

  /**
   * Latest stats.
   *
   * @returns Stats, or `null` until the server sends them.
   */
  get stats(): NodeStats | null {
    return this.#stats;
  }

  /**
   * What this node can do.
   *
   * @returns The capability set.
   */
  get capabilities(): CapabilitySet {
    return this.#capabilities;
  }

  /**
   * Current Lavalink session id.
   *
   * @returns The id, or `null` before the first `ready`.
   */
  get sessionId(): string | null {
    return this.#sessionId;
  }

  /**
   * Checks for a capability.
   *
   * @param capability - Capability to check.
   * @returns `true` when the node has it.
   */
  supports(capability: Capability): boolean {
    return this.#capabilities.has(capability);
  }

  /**
   * Returns the session id, or throws when the node isn't ready.
   *
   * @returns The session id.
   * @throws {LunalinkError} `NODE_NOT_READY` before the first `ready`.
   */
  requireSessionId(): string {
    if (this.#sessionId === null || this.#state === "destroyed") {
      throw new LunalinkError(ErrorCode.NodeNotReady, `Node "${this.id}" has no session yet.`, {
        details: { nodeId: this.id, state: this.#state },
      });
    }
    return this.#sessionId;
  }

  /**
   * Connects, and reconnects automatically from then on.
   *
   * @returns Resolves on the first `ready`.
   * @throws {LunalinkError} When the bot's user id isn't known yet, or the node gives up.
   */
  connect(): Promise<void> {
    if (this.#state === "destroyed") {
      return Promise.reject(
        new LunalinkError(ErrorCode.NodeNotReady, `Node "${this.id}" was destroyed.`),
      );
    }
    if (this.#runtime.userId() === undefined) {
      return Promise.reject(
        new LunalinkError(
          ErrorCode.InvalidOption,
          "The bot's user id is unknown. Connect nodes after the bot has logged in.",
        ),
      );
    }
    if (this.#state === "ready") return Promise.resolve();
    if (this.#machine.state === "stopped") {
      this.#state = "connecting";
      this.#readyOnce = this.#waitForReady();
      this.#machine.start();
    }
    return this.#readyOnce ?? this.#waitForReady();
  }

  /**
   * Closes the connection without destroying the node. `connect()` can start it again.
   *
   * @param code - Close code.
   * @param reason - Close reason.
   */
  disconnect(code = 1000, reason = "Disconnected by client"): void {
    if (this.#state === "destroyed") return;
    this.#machine.stop(code, reason);
    this.#state = "disconnected";
    this.#readyOnce = null;
  }

  /**
   * Drops the socket and reconnects right away, resuming the session when possible.
   */
  reconnect(): void {
    this.#machine.reconnectNow("Manual reconnect");
  }

  /**
   * Stops the node for good and clears every timer and listener.
   */
  destroy(): void {
    if (this.#state === "destroyed") return;
    this.#machine.stop(1000, "Node destroyed");
    this.#timers.clearAll();
    this.#state = "destroyed";
    this.events.emit("destroy");
    this.events.removeAllListeners();
  }

  /**
   * Fetches `/v4/stats` and stores the result.
   *
   * @returns The new stats.
   */
  async refreshStats(): Promise<NodeStats | null> {
    const stats = this.#driver.normalizeStats(await this.rest.stats());
    if (stats) this.#stats = stats;
    return stats;
  }

  async #preflight(signal: AbortSignal): Promise<void> {
    const response = await this.http.requestWithResponse<unknown>("GET", Routes.info(), { signal });
    const kind =
      this.options.type === "auto"
        ? detectKind(response.headers, response.data)
        : this.options.type;
    const driver = this.#driver.kind === kind ? this.#driver : driverFor(kind);
    const info = driver.normalizeInfo(response.data);
    this.#driver = driver;
    this.#info = info;
    this.#capabilities = resolveCapabilities(
      this.id,
      {
        kind,
        plugins: info.plugins.map((plugin) => plugin.name),
        sourceManagers: info.sourceManagers,
        filters: info.filters,
        version: info.version,
        raw: info.raw,
      },
      this.#runtime.capabilityRules(),
      this.options.assumeCapabilities,
    );
    this.events.emit("info", info);
    this.#debug("info", `Server is ${kind} ${info.version.semver}`);
  }

  #upgradeHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.options.headers,
      Authorization: this.options.password,
      "User-Id": this.#runtime.userId() ?? "",
      "Client-Name": this.#runtime.clientName,
    };
    if (this.#sessionId !== null) headers["Session-Id"] = this.#sessionId;
    return headers;
  }

  #waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const offReady = this.events.once("ready", () => {
        offGiveUp();
        resolve();
      });
      const offGiveUp = this.events.once("giveUp", (error) => {
        offReady();
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  #debug(level: DebugEvent["level"], message: string, data?: Record<string, unknown>): void {
    this.#runtime.debug({ scope: `node:${this.id}`, level, message, ...(data ? { data } : {}) });
  }
}

function isFatal(error: unknown): boolean {
  if (error instanceof RestError)
    return error.code === ErrorCode.Unauthorized || error.status === 404;
  return error instanceof TypeError || error instanceof LunalinkError;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
