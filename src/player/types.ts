import type {
  Chapter,
  Lyrics,
  LyricsLine,
  SponsorBlockSegment,
  TrackEndReason,
} from "../drivers/types.js";
import type { ApiEventBase, ApiException, ApiPlayerState } from "../protocol/index.js";
import type { LoopMode, QueueChange } from "../queue/types.js";
import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";

/**
 * Settings for a new player.
 *
 * @example
 * ```ts
 * lunalink.players.create({ guildId, voiceChannelId, textChannelId, volume: 80 });
 * ```
 */
export interface PlayerOptions {
  /** Guild id. */
  guildId: string;
  /** Voice channel to join. */
  voiceChannelId: string;
  /** Text channel for messages. Lunalink only stores it for you. */
  textChannelId?: string | null;
  /** Join deafened. Defaults to `true`, which saves bandwidth. */
  selfDeaf?: boolean;
  /** Join muted. Defaults to `false`. */
  selfMute?: boolean;
  /** Starting volume, 0 to 1000. Defaults to the manager's `defaultVolume`. */
  volume?: number;
  /** Starting loop mode. Defaults to `off`. */
  loop?: LoopMode;
  /** Play related tracks when the queue runs out. Defaults to the manager's setting. */
  autoplay?: boolean;
  /** Pin the player to a node instead of letting the selector pick. */
  nodeId?: string;
}

/**
 * Options for {@link Player.play}.
 */
export interface PlayOptions {
  /** Start position in milliseconds. */
  startTime?: number;
  /** Stop position in milliseconds. */
  endTime?: number;
  /** Start paused. */
  paused?: boolean;
  /** Audio language for sources with several dubs. NodeLink only. */
  language?: string;
}

/**
 * Why a player was destroyed.
 *
 * - `manual`: your code called `destroy()`.
 * - `disconnected`: the bot was removed from the voice channel.
 * - `autoLeave`: the queue ended or the channel was empty for too long.
 * - `nodeLost`: its node died and no other node could take it.
 * - `shutdown`: Lunalink is shutting down.
 */
export type DestroyReason = "manual" | "disconnected" | "autoLeave" | "nodeLost" | "shutdown";

/**
 * What went wrong when a track failed.
 */
export interface TrackErrorInfo {
  /** Where it failed. */
  kind: "exception" | "loadFailed" | "resolveFailed" | "stuck";
  /** Short description. */
  message: string;
  /** The server's exception, for `exception`. */
  exception: ApiException | null;
  /** The underlying error, for `resolveFailed`. */
  cause: unknown;
}

/**
 * Where a player's playback stands.
 */
export type PlaybackState = "idle" | "playing" | "paused" | "destroyed";

/**
 * Events about players, generic over the player class. Every listener gets the player first.
 */
export interface PlayerEventMap<P> {
  /** A player was created. */
  playerCreate: [player: P];
  /** A player was destroyed. */
  playerDestroy: [player: P, reason: DestroyReason];
  /** The player connected to voice. */
  playerConnect: [player: P];
  /** Discord removed the bot from voice. */
  playerDisconnect: [player: P];
  /** The bot was moved to another voice channel. */
  playerMove: [player: P, from: string, to: string];
  /** The player moved to another node. */
  playerNodeChange: [player: P, fromNodeId: string, toNodeId: string];
  /** A position update arrived. */
  playerUpdate: [player: P, state: ApiPlayerState];
  /** A track started. */
  trackStart: [player: P, track: Track];
  /** A track ended. */
  trackEnd: [player: P, track: Track, reason: TrackEndReason];
  /** A track failed to load or play. */
  trackError: [player: P, track: Track | UnresolvedTrack, error: TrackErrorInfo];
  /** A track stopped producing audio. */
  trackStuck: [player: P, track: Track, thresholdMs: number];
  /** The queue ran out and autoplay found nothing. */
  queueEnd: [player: P, lastTrack: Track | null];
  /** The queue changed. */
  queueUpdate: [player: P, change: QueueChange];
  /** The node's connection to Discord voice closed. */
  voiceClosed: [player: P, code: number, reason: string, byRemote: boolean];
  /** SponsorBlock segments were loaded. */
  segmentsLoaded: [player: P, segments: SponsorBlockSegment[]];
  /** A SponsorBlock segment was skipped. */
  segmentSkipped: [player: P, segment: SponsorBlockSegment];
  /** Chapters were loaded. Lavalink SponsorBlock plugin only. */
  chaptersLoaded: [player: P, chapters: Chapter[]];
  /** A chapter started. Lavalink SponsorBlock plugin only. */
  chapterStarted: [player: P, chapter: Chapter];
  /** Live lyrics were found for the current track. */
  lyricsFound: [player: P, lyrics: Lyrics];
  /** No live lyrics for the current track. */
  lyricsNotFound: [player: P];
  /** Playback reached a lyrics line. */
  lyricsLine: [player: P, line: LyricsLine, index: number, skipped: boolean];
  /** A NodeLink-only event, such as `MixStartedEvent`. */
  nodeLinkEvent: [player: P, name: string, payload: ApiEventBase];
}
