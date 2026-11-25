import type { JsonValue } from "./json.js";

/**
 * One equalizer band. There are 15 bands, numbered 0 to 14 (25 Hz to 16 kHz).
 */
export interface ApiEqualizerBand {
  /** Band index, 0 to 14. */
  band: number;
  /** Gain from -0.25 (muted) to 1.0. 0 leaves the band unchanged. */
  gain: number;
}

/**
 * Removes part of the frequency range, usually to cut vocals.
 */
export interface ApiKaraokeFilter {
  /** Effect strength, 0 to 1. */
  level?: number;
  /** Mono effect strength, 0 to 1. */
  monoLevel?: number;
  /** Center of the removed band in Hz. Lavalink defaults to 220. */
  filterBand?: number;
  /** Width of the removed band. Lavalink defaults to 100. */
  filterWidth?: number;
}

/**
 * Changes speed, pitch and rate. 1.0 is normal for all three.
 */
export interface ApiTimescaleFilter {
  /** Playback speed, 0 or more. */
  speed?: number;
  /** Pitch, 0 or more. */
  pitch?: number;
  /** Rate (speed and pitch together), 0 or more. */
  rate?: number;
}

/**
 * Rapidly changes volume.
 */
export interface ApiTremoloFilter {
  /** How fast the volume changes, above 0. */
  frequency?: number;
  /** How strong the change is, above 0 and up to 1. */
  depth?: number;
}

/**
 * Rapidly changes pitch.
 */
export interface ApiVibratoFilter {
  /** How fast the pitch changes, above 0 and up to 14. */
  frequency?: number;
  /** How strong the change is, above 0 and up to 1. */
  depth?: number;
}

/**
 * Moves the sound around the listener's head. 0.2 gives the classic "8D" effect.
 */
export interface ApiRotationFilter {
  /** Rotation speed in Hz. */
  rotationHz?: number;
}

/**
 * Distorts the waveform with sine, cosine and tangent terms.
 */
export interface ApiDistortionFilter {
  /** Sine offset. */
  sinOffset?: number;
  /** Sine scale. */
  sinScale?: number;
  /** Cosine offset. */
  cosOffset?: number;
  /** Cosine scale. */
  cosScale?: number;
  /** Tangent offset. */
  tanOffset?: number;
  /** Tangent scale. */
  tanScale?: number;
  /** Overall offset. */
  offset?: number;
  /** Overall scale. */
  scale?: number;
}

/**
 * Mixes the left and right channels. All factors are 0 to 1; setting all four to 0.5 makes it mono.
 */
export interface ApiChannelMixFilter {
  /** How much of the left channel stays on the left. */
  leftToLeft?: number;
  /** How much of the left channel goes to the right. */
  leftToRight?: number;
  /** How much of the right channel goes to the left. */
  rightToLeft?: number;
  /** How much of the right channel stays on the right. */
  rightToRight?: number;
}

/**
 * Cuts high frequencies. Smoothing of 1 or less turns it off.
 */
export interface ApiLowPassFilter {
  /** Smoothing factor, above 1. */
  smoothing?: number;
}

/**
 * The filters object sent in `PATCH /v4/sessions/{sessionId}/players/{guildId}`.
 *
 * Sending this replaces every filter that was active before. A sub-filter set to `null` clears it.
 */
export interface ApiFilters {
  /** Filter volume, 0 to 5. 1 is unchanged. Values above 1 can clip. */
  volume?: number;
  /** Equalizer bands to change. Bands left out stay at 0. */
  equalizer?: ApiEqualizerBand[];
  /** Karaoke filter. */
  karaoke?: ApiKaraokeFilter | null;
  /** Timescale filter. */
  timescale?: ApiTimescaleFilter | null;
  /** Tremolo filter. */
  tremolo?: ApiTremoloFilter | null;
  /** Vibrato filter. */
  vibrato?: ApiVibratoFilter | null;
  /** Rotation filter. */
  rotation?: ApiRotationFilter | null;
  /** Distortion filter. */
  distortion?: ApiDistortionFilter | null;
  /** Channel mix filter. */
  channelMix?: ApiChannelMixFilter | null;
  /** Low pass filter. */
  lowPass?: ApiLowPassFilter | null;
  /** Filters from server plugins, keyed by the plugin's filter name. */
  pluginFilters?: Record<string, JsonValue>;
}

/**
 * Names of the filters built into Lavalink, as listed in `GET /v4/info`.
 */
export type ApiCoreFilterName =
  | "volume"
  | "equalizer"
  | "karaoke"
  | "timescale"
  | "tremolo"
  | "vibrato"
  | "rotation"
  | "distortion"
  | "channelMix"
  | "lowPass";
