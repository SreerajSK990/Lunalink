import type { Capability } from "../capabilities/Capability.js";
import type { TrackEndReason } from "../drivers/types.js";
import type { ApiPlayerState, ApiVoiceState } from "../protocol/index.js";
import type { FilterState } from "../filters/types.js";
import type { Track } from "../track/Track.js";

/**
 * Events a backend reports for a guild.
 */
export interface BackendEventMap {
  /** A track started. */
  trackStart: [guildId: string, track: Track];
  /** A track ended. */
  trackEnd: [guildId: string, track: Track, reason: TrackEndReason];
  /** A track failed. */
  trackException: [guildId: string, track: Track, message: string];
  /** A track stopped sending audio. */
  trackStuck: [guildId: string, track: Track, thresholdMs: number];
  /** Position update. */
  playerUpdate: [guildId: string, state: ApiPlayerState];
  /** The Discord voice connection closed. */
  voiceClosed: [guildId: string, code: number, reason: string, byRemote: boolean];
}

/**
 * How a backend should start a track.
 */
export interface BackendPlayOptions {
  /** Start position in milliseconds. */
  startMs?: number;
  /** Stop position in milliseconds. */
  endMs?: number;
  /** Start paused. */
  paused?: boolean;
  /** Volume, 0 to 1000. */
  volume?: number;
}

/**
 * A playback engine other than Lavalink or NodeLink, for example an in-process one for a
 * standalone bot. The backend owns audio and the Discord voice protocol; Lunalink owns
 * everything above it.
 *
 * Register one with `ctx.backends.register()`; `lunalink.plugins.backends()` lists them.
 * Players are not routed to registered backends yet.
 */
export interface PlaybackBackend {
  /** Unique id, used like a node id. */
  readonly id: string;
  /** What the backend supports. */
  readonly capabilities: readonly Capability[];
  /**
   * Joins voice with the credentials Discord sent.
   *
   * @param guildId - Guild id.
   * @param voice - Voice credentials.
   */
  connect(guildId: string, voice: ApiVoiceState): Promise<void>;
  /**
   * Plays a track.
   *
   * @param guildId - Guild id.
   * @param track - The track.
   * @param options - Start, end, pause and volume.
   */
  play(guildId: string, track: Track, options: BackendPlayOptions): Promise<void>;
  /**
   * Stops the track.
   *
   * @param guildId - Guild id.
   */
  stop(guildId: string): Promise<void>;
  /**
   * Pauses or resumes.
   *
   * @param guildId - Guild id.
   * @param paused - `true` to pause.
   */
  pause(guildId: string, paused: boolean): Promise<void>;
  /**
   * Seeks.
   *
   * @param guildId - Guild id.
   * @param positionMs - Position.
   */
  seek(guildId: string, positionMs: number): Promise<void>;
  /**
   * Changes the volume.
   *
   * @param guildId - Guild id.
   * @param volume - 0 to 1000.
   */
  setVolume(guildId: string, volume: number): Promise<void>;
  /**
   * Applies filters. Optional.
   *
   * @param guildId - Guild id.
   * @param filters - Filters.
   */
  setFilters?(guildId: string, filters: FilterState): Promise<void>;
  /**
   * Leaves voice and forgets the guild.
   *
   * @param guildId - Guild id.
   */
  destroy(guildId: string): Promise<void>;
  /**
   * Listens to backend events.
   *
   * @param name - Event name.
   * @param listener - Listener.
   * @returns A function that stops listening.
   */
  on<Name extends keyof BackendEventMap>(
    name: Name,
    listener: (...args: BackendEventMap[Name]) => void,
  ): () => void;
}
