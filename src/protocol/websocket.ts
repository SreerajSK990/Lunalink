import type { ApiEventBase } from "./events.js";
import type { ApiNodeLinkStats } from "./nodelink/stats.js";
import type { ApiPlayerState } from "./player.js";
import type { ApiLavalinkStats } from "./stats.js";

/**
 * Sent once right after the WebSocket connects.
 */
export interface ApiReadyMessage {
  /** Always `ready`. */
  op: "ready";
  /** Whether an earlier session was resumed. */
  resumed: boolean;
  /** Session id to use in REST paths. Not related to the Discord voice session id. */
  sessionId: string;
}

/**
 * Sent every few seconds for each player, and once per player right after a resume.
 */
export interface ApiPlayerUpdateMessage {
  /** Always `playerUpdate`. */
  op: "playerUpdate";
  /** Guild the player belongs to. */
  guildId: string;
  /** Live player state. */
  state: ApiPlayerState;
}

/**
 * Sent regularly with server statistics: every minute on Lavalink, every 30 seconds by default
 * on NodeLink.
 */
export type ApiStatsMessage = { op: "stats" } & (ApiLavalinkStats | ApiNodeLinkStats);

/**
 * Any message the server can send over the WebSocket. Events are kept open-ended because
 * servers and plugins add their own event types.
 */
export type ApiIncomingMessage =
  ApiReadyMessage | ApiPlayerUpdateMessage | ApiStatsMessage | ApiEventBase;

/**
 * Request headers for opening the WebSocket at `/v4/websocket`.
 */
export interface ApiWebSocketHeaders {
  /** Server password. */
  Authorization: string;
  /** Bot user id. */
  "User-Id": string;
  /** Client name in `NAME/VERSION` form. */
  "Client-Name": string;
  /** Id of a previous session to resume. */
  "Session-Id"?: string;
}
