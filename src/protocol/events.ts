import type { ApiException, ApiTrack } from "./track.js";

/**
 * Why Lavalink ended a track.
 *
 * - `finished`: it played to the end. The next track may start.
 * - `loadFailed`: it could not be loaded. The next track may start.
 * - `stopped`: it was stopped on purpose.
 * - `replaced`: another track was started in its place.
 * - `cleanup`: the player was cleaned up, for example after destroy.
 */
export type ApiTrackEndReason = "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup";

/**
 * Fields every event message shares.
 */
export interface ApiEventBase {
  /** Always `event`. */
  op: "event";
  /** Event type, for example `TrackStartEvent`. */
  type: string;
  /** Guild the event belongs to. */
  guildId: string;
}

/**
 * A track started playing.
 */
export interface ApiTrackStartEvent extends ApiEventBase {
  /** Always `TrackStartEvent`. */
  type: "TrackStartEvent";
  /** The track that started. */
  track: ApiTrack;
}

/**
 * A track stopped playing.
 */
export interface ApiTrackEndEvent extends ApiEventBase {
  /** Always `TrackEndEvent`. */
  type: "TrackEndEvent";
  /** The track that ended. */
  track: ApiTrack;
  /** Why it ended. NodeLink can also send `gapless` and `crossfading`. */
  reason: ApiTrackEndReason;
}

/**
 * A track threw an error while playing.
 */
export interface ApiTrackExceptionEvent extends ApiEventBase {
  /** Always `TrackExceptionEvent`. */
  type: "TrackExceptionEvent";
  /** The track that failed. */
  track: ApiTrack;
  /** What went wrong. */
  exception: ApiException;
}

/**
 * A track stopped producing audio for longer than the server's threshold.
 */
export interface ApiTrackStuckEvent extends ApiEventBase {
  /** Always `TrackStuckEvent`. */
  type: "TrackStuckEvent";
  /** The stuck track. */
  track: ApiTrack;
  /** The threshold that was exceeded, in milliseconds. */
  thresholdMs: number;
}

/**
 * The server's connection to the Discord voice gateway closed.
 */
export interface ApiWebSocketClosedEvent extends ApiEventBase {
  /** Always `WebSocketClosedEvent`. */
  type: "WebSocketClosedEvent";
  /** Discord voice close code, for example 4006 or 4014. */
  code: number;
  /** Close reason from Discord. */
  reason: string;
  /** Whether Discord closed the connection, rather than the server. */
  byRemote: boolean;
}

/**
 * The five events every Lavalink v4 server sends.
 */
export type ApiCoreEvent =
  | ApiTrackStartEvent
  | ApiTrackEndEvent
  | ApiTrackExceptionEvent
  | ApiTrackStuckEvent
  | ApiWebSocketClosedEvent;
