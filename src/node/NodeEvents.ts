import type { NodeEvent, NodeInfo, NodeStats } from "../drivers/types.js";
import type { ApiPlayerState } from "../protocol/index.js";

/**
 * Events a {@link Node} emits on `node.events`.
 */
export interface NodeEvents {
  /** The server sent `ready`. */
  ready: [resumed: boolean, sessionId: string];
  /** `/v4/info` was read during a connect attempt. */
  info: [info: NodeInfo];
  /** An open connection closed. A reconnect follows unless the node was stopped. */
  disconnect: [code: number, reason: string];
  /** A reconnect is scheduled. */
  reconnecting: [attempt: number, delayMs: number, error: unknown];
  /** Something went wrong on this node. */
  error: [error: unknown];
  /** The node stopped reconnecting. */
  giveUp: [error: unknown];
  /** New stats arrived. */
  stats: [stats: NodeStats];
  /** A player's position update arrived. */
  playerUpdate: [guildId: string, state: ApiPlayerState];
  /** A server event arrived, already normalized. */
  event: [event: NodeEvent];
  /** Any message, exactly as it arrived (parsed JSON). */
  raw: [payload: unknown];
  /** The node was destroyed. */
  destroy: [];
}
