import type { ApiFilters } from "../protocol/index.js";

/**
 * Animates a NodeLink filter change instead of switching instantly.
 */
export interface FilterTransition {
  /** Animation length in milliseconds. */
  durationMs: number;
  /** Curve name, for example `linear`. */
  curve?: string;
}

/**
 * Fields every NodeLink-only filter accepts.
 *
 * Source: `src/typings/playback/filters.types.ts` in NodeLink.
 */
export interface NodeLinkFilterBase {
  /** Animate the change. */
  transition?: FilterTransition;
  /** Smoothing factor for parameter changes. */
  alpha?: number;
}

/**
 * Cuts low frequencies. NodeLink only.
 */
export interface HighPassFilter {
  /** Smoothing factor. */
  smoothing?: number;
  /** Target smoothing for animated changes. */
  targetAlpha?: number;
  /** Animate the change. */
  transition?: FilterTransition;
}

/**
 * Echo. NodeLink only. Active when both `delay` and `mix` are above 0.
 */
export interface EchoFilter extends NodeLinkFilterBase {
  /** Delay in milliseconds. */
  delay?: number;
  /** How much of the echo feeds back, 0 to 1. */
  feedback?: number;
  /** Wet/dry mix, 0 to 1. */
  mix?: number;
}

/**
 * Room reverb. NodeLink only.
 */
export interface ReverbFilter extends NodeLinkFilterBase {
  /** Room size, 0 to 1. */
  roomSize?: number;
  /** High-frequency damping, 0 to 1. */
  damping?: number;
  /** Reverb level. */
  wetLevel?: number;
  /** Original signal level. */
  dryLevel?: number;
  /** Stereo width. */
  width?: number;
  /** Overall mix. */
  mix?: number;
}

/**
 * Shared shape of chorus and flanger. NodeLink only.
 */
export interface ModulationFilter extends NodeLinkFilterBase {
  /** Modulation speed. */
  rate?: number;
  /** Modulation depth. */
  depth?: number;
  /** Feedback amount. */
  feedback?: number;
  /** Base delay. */
  delay?: number;
  /** Wet/dry mix. */
  mix?: number;
}

/**
 * Phaser. NodeLink only.
 */
export interface PhaserFilter extends ModulationFilter {
  /** Number of all-pass stages. */
  stages?: number;
  /** Lowest swept frequency in Hz. */
  minFrequency?: number;
  /** Highest swept frequency in Hz. */
  maxFrequency?: number;
}

/**
 * 3D positioning. NodeLink only.
 */
export interface SpatialFilter extends NodeLinkFilterBase {
  /** Left/right position. */
  x?: number;
  /** Up/down position. */
  y?: number;
  /** Front/back position. */
  z?: number;
  /** Effect depth. */
  depth?: number;
  /** Movement speed. */
  rate?: number;
}

/**
 * Dynamic range compressor. NodeLink only.
 */
export interface CompressorFilter extends NodeLinkFilterBase {
  /** Level where compression starts, in dB. */
  threshold?: number;
  /** Compression ratio. */
  ratio?: number;
  /** Attack time. */
  attack?: number;
  /** Release time. */
  release?: number;
  /** Input gain. */
  gain?: number;
  /** Output gain. */
  makeupGain?: number;
}

/**
 * Old record player sound. NodeLink only.
 */
export interface PhonographFilter extends NodeLinkFilterBase {
  /** Wobble speed. */
  frequency?: number;
  /** Wobble depth. */
  depth?: number;
  /** Crackle amount. */
  crackle?: number;
  /** Speed flutter. */
  flutter?: number;
  /** Room amount. */
  room?: number;
  /** Automatic gain. */
  micAgc?: number;
  /** Drive. */
  drive?: number;
}

/**
 * Rotation variant. NodeLink only.
 */
export interface TesseractFilter extends NodeLinkFilterBase {
  /** Rotation speed in Hz. */
  rotationHz?: number;
}

/**
 * Every filter Lunalink can send. The Lavalink v4 filters work everywhere; the rest only work on
 * NodeLink. Use `pluginFilters` for Lavalink plugin filters such as LavaDSPX.
 */
export interface FilterState extends ApiFilters {
  /** High pass. NodeLink only. */
  highPass?: HighPassFilter | null;
  /** Echo. NodeLink only. */
  echo?: EchoFilter | null;
  /** Reverb. NodeLink only. */
  reverb?: ReverbFilter | null;
  /** Chorus. NodeLink only. */
  chorus?: ModulationFilter | null;
  /** Flanger. NodeLink only. */
  flanger?: ModulationFilter | null;
  /** Phaser. NodeLink only. */
  phaser?: PhaserFilter | null;
  /** 3D spatial. NodeLink only. */
  spatial?: SpatialFilter | null;
  /** Compressor. NodeLink only. */
  compressor?: CompressorFilter | null;
  /** Phonograph. NodeLink only. */
  phonograph?: PhonographFilter | null;
  /** Tesseract. NodeLink only. */
  tesseract?: TesseractFilter | null;
}

/**
 * Names of the filters in {@link FilterState}, apart from `pluginFilters`.
 */
export type FilterName = Exclude<keyof FilterState, "pluginFilters">;

/**
 * A named set of filters, such as `nightcore`.
 */
export interface FilterPreset {
  /** Preset name. */
  name: string;
  /** One-line description shown in help commands. */
  description: string;
  /** Filters the preset sets. */
  filters: Partial<FilterState>;
}
