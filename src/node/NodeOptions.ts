import type { Capability } from "../capabilities/Capability.js";
import type { NodeKind } from "../drivers/types.js";

/**
 * How a node reconnects after it drops.
 */
export interface NodeReconnectOptions {
  /** First retry delay ceiling in milliseconds. Defaults to 1000. */
  baseDelayMs?: number;
  /** Longest delay between retries in milliseconds. Defaults to 30000. */
  maxDelayMs?: number;
  /** Give up after this many failed attempts in a row. Defaults to `Infinity`. */
  maxAttempts?: number;
}

/**
 * Settings for one Lavalink or NodeLink server.
 *
 * @example
 * ```ts
 * { id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }
 * ```
 */
export interface NodeOptions {
  /** Unique name. Defaults to `host:port`. */
  id?: string;
  /** Host name or IP. */
  host: string;
  /** Port. */
  port: number;
  /** Server password. */
  password: string;
  /** Use `https` and `wss`. Defaults to `false`. */
  secure?: boolean;
  /** Force the server kind instead of detecting it. Defaults to `auto`. */
  type?: "auto" | NodeKind;
  /** Discord voice regions this node should serve, for example `["us", "eu"]`. */
  regions?: string[];
  /** Higher numbers are preferred by the `priority` selection strategy. Defaults to 0. */
  priority?: number;
  /** Session to resume on the first connect, for example one saved before a restart. */
  sessionId?: string;
  /** REST timeout in milliseconds. Defaults to 10000. */
  requestTimeoutMs?: number;
  /** Reconnect behavior. */
  reconnect?: NodeReconnectOptions;
  /**
   * Reconnect when nothing arrives on the WebSocket for this long, in milliseconds. Servers send
   * stats every 30 to 60 seconds, so the default of 150000 leaves room. 0 turns it off.
   */
  silenceTimeoutMs?: number;
  /** Capabilities to add even though the server doesn't report them. */
  assumeCapabilities?: Capability[];
  /** Extra headers for every request to this node. */
  headers?: Record<string, string>;
}

/**
 * Node settings after defaults are applied.
 */
export interface ResolvedNodeOptions {
  /** Unique name. */
  id: string;
  /** Host name or IP. */
  host: string;
  /** Port. */
  port: number;
  /** Server password. */
  password: string;
  /** Whether TLS is used. */
  secure: boolean;
  /** Forced kind, or `auto`. */
  type: "auto" | NodeKind;
  /** Voice regions. */
  regions: readonly string[];
  /** Selection priority. */
  priority: number;
  /** Session to resume first. */
  sessionId: string | undefined;
  /** REST timeout. */
  requestTimeoutMs: number;
  /** Reconnect behavior. */
  reconnect: Required<NodeReconnectOptions>;
  /** Silence timeout. */
  silenceTimeoutMs: number;
  /** Assumed capabilities. */
  assumeCapabilities: readonly Capability[];
  /** Extra headers. */
  headers: Readonly<Record<string, string>>;
}
