import type { ApiEventBase, ApiTrackEndReason } from "../events.js";
import type { ApiFilters } from "../filters.js";
import type { ApiTrack } from "../track.js";
import type { ApiNodeLinkLiveLyrics, ApiNodeLinkLiveLyricsLine } from "./lyrics.js";
import type { ApiNodeLinkConnectionStatus, ApiNodeLinkSponsorBlockSegment } from "./rest.js";

/**
 * NodeLink's track end reasons. On top of Lavalink's, `gapless` means the queued `nextTrack`
 * already took over, and `crossfading` means the next track is fading in.
 *
 * Source: `src/constants.ts` (`EndReasons`).
 */
export type ApiNodeLinkTrackEndReason = ApiTrackEndReason | "gapless" | "crossfading";

/**
 * Payloads of every NodeLink-only event, keyed by `type`. Each event also carries `op` and
 * `guildId`. Fields are taken from the `emitEvent` calls in `src/playback/player.ts`.
 */
export interface ApiNodeLinkEventPayloads {
  /** SponsorBlock segments were loaded. */
  SponsorBlockSegmentsLoadedEvent: { segments: ApiNodeLinkSponsorBlockSegment[] };
  /** A SponsorBlock segment was skipped. */
  SponsorBlockSegmentSkippedEvent: { track: ApiTrack; segment: ApiNodeLinkSponsorBlockSegment };
  /** Lyrics were found for the current track. */
  LyricsFoundEvent: { lyrics: ApiNodeLinkLiveLyrics };
  /** No lyrics were found. */
  LyricsNotFoundEvent: Record<string, never>;
  /** Playback reached a new lyrics line. */
  LyricsLineEvent: { lineIndex: number; line: ApiNodeLinkLiveLyricsLine; skipped: boolean };
  /** Network quality changed. */
  ConnectionStatusEvent: { status: ApiNodeLinkConnectionStatus; [key: string]: unknown };
  /** Volume changed. */
  VolumeChangedEvent: { volume: number };
  /** Filters changed. */
  FiltersChangedEvent: { filters: ApiFilters };
  /** The player seeked. `duration` is the jump in milliseconds. */
  SeekEvent: { position: number; duration: number };
  /** The player was paused or resumed. */
  PauseEvent: { paused: boolean };
  /** A player was created. */
  PlayerCreatedEvent: { player: Record<string, unknown> };
  /** A player was destroyed. */
  PlayerDestroyedEvent: Record<string, never>;
  /** The player is reconnecting to Discord voice. */
  PlayerReconnectingEvent: { voice: Record<string, unknown> };
  /** The player connected to Discord voice. */
  PlayerConnectedEvent: { voice: Record<string, unknown> };
  /** A mix layer started. */
  MixStartedEvent: { mixId: string; track: ApiTrack; volume: number };
  /** A mix layer ended. */
  MixEndedEvent: { mixId: string; reason: string };
  /** EternalBox playback info changed. */
  EternalBoxInfoEvent: { track: ApiTrack; eternalbox: Record<string, unknown> };
  /** EternalBox jumped to another point. */
  EternalBoxJumpEvent: { track: ApiTrack; eternalbox: Record<string, unknown> };
  /** A live stream sent new metadata, such as the current song on a radio. */
  StreamMetadataEvent: { track: ApiTrack; stream: Record<string, unknown> };
  /** Snapshot of every source's health. */
  SourceHealthSnapshotEvent: Record<string, unknown>;
  /** A source's health changed. */
  SourceHealthChangeEvent: Record<string, unknown>;
  /** A NodeLink worker process failed. */
  WorkerFailedEvent: Record<string, unknown>;
}

/**
 * Names of NodeLink-only events.
 */
export type ApiNodeLinkEventType = keyof ApiNodeLinkEventPayloads;

/**
 * A NodeLink-only event as it arrives over the WebSocket.
 */
export type ApiNodeLinkEvent<Type extends ApiNodeLinkEventType = ApiNodeLinkEventType> = {
  [Key in Type]: ApiEventBase & { type: Key } & ApiNodeLinkEventPayloads[Key];
}[Type];
