import type { ApiUpdatePlayer, ApiUpdatePlayerTrack } from "../player.js";

/**
 * How a NodeLink fade sounds. `tape` and `scratch` imitate a turntable slowing down or speeding up.
 */
export type ApiNodeLinkFadeType = "volume" | "tape" | "scratch" | "both";

/**
 * One fade setting.
 */
export interface ApiNodeLinkFadeSection {
  /** Fade length in milliseconds. */
  duration?: number;
  /** Curve name, for example `linear`. */
  curve?: string;
  /** Kind of fade. */
  type?: ApiNodeLinkFadeType;
}

/**
 * Fade settings for each moment a fade can happen.
 *
 * Source: `src/api/sessions.id.players.ts` (fading sanitizer).
 */
export interface ApiNodeLinkFading {
  /** Master switch. NodeLink treats a missing value as `false`. */
  enabled?: boolean;
  /** Fade in when a track starts. */
  trackStart?: ApiNodeLinkFadeSection;
  /** Fade out when a track ends. */
  trackEnd?: ApiNodeLinkFadeSection;
  /** Fade out when playback is stopped. */
  trackStop?: ApiNodeLinkFadeSection;
  /** Fade around a seek. */
  seek?: ApiNodeLinkFadeSection;
  /** Fade out on pause. */
  pause?: ApiNodeLinkFadeSection;
  /** Fade in on resume. */
  resume?: ApiNodeLinkFadeSection;
  /** Lower the music while a mix layer plays. */
  ducking?: {
    enabled?: boolean;
    duration?: number;
    targetVolume?: number;
    curve?: string;
  };
}

/**
 * Crossfade between tracks. NodeLink caps `duration` at 30 seconds.
 */
export interface ApiNodeLinkCrossfade {
  /** Turn crossfading on or off. */
  enabled: boolean;
  /** Overlap in milliseconds. Defaults to 5000. */
  duration?: number;
  /** `linear`, `sine` or `sinusoidal`. Defaults to `sinusoidal`. */
  curve?: "linear" | "sine" | "sinusoidal";
  /** How the next track is prepared. Defaults to `preload`. */
  mode?: "preload" | "stream" | "smart";
  /** Minimum buffered audio before crossfading, in milliseconds. */
  minBufferMs?: number;
  /** Extra buffer in milliseconds. */
  bufferMs?: number;
}

/**
 * The track part of a NodeLink update, which can pick an audio language for sources that have
 * several dubs.
 */
export interface ApiNodeLinkUpdatePlayerTrack extends ApiUpdatePlayerTrack {
  /** Audio track id to play. */
  audioTrackId?: string;
  /** Audio language to play, for example `en`. */
  language?: string;
}

/**
 * NodeLink's update player body: everything Lavalink accepts plus NodeLink-only fields.
 *
 * Source: `src/api/sessions.id.players.ts` (`getPlayerPatchPayload`).
 */
export interface ApiNodeLinkUpdatePlayer extends Omit<ApiUpdatePlayer, "track"> {
  /** Track to play. */
  track?: ApiNodeLinkUpdatePlayerTrack;
  /** Track to start right after the current one, without a gap. `null` clears it. */
  nextTrack?: ApiNodeLinkUpdatePlayerTrack | null;
  /** Same as `position`. NodeLink reads `position` first. */
  startTime?: number;
  /** Crossfade settings. */
  crossfade?: ApiNodeLinkCrossfade;
  /** Fade settings, including the ducking curve. */
  fading?: ApiNodeLinkFading;
  /** Turn ducking on or off without resending the fade settings. */
  ducking?: boolean;
  /** Turn loudness normalization on or off. */
  loudnessNormalizer?: boolean;
}
