/**
 * Cuts frequencies below the cutoff. Key `high-pass` in `pluginFilters`.
 */
export interface ApiDspxHighPassFilter {
  /** Cutoff in Hz, above 0. */
  cutoffFrequency: number;
  /** Output gain, above 0. 1 leaves the volume unchanged. */
  boostFactor: number;
}

/**
 * Cuts frequencies above the cutoff. Key `low-pass` in `pluginFilters`.
 */
export interface ApiDspxLowPassFilter {
  /** Cutoff in Hz, above 0. */
  cutoffFrequency: number;
  /** Output gain, above 0. 1 leaves the volume unchanged. */
  boostFactor: number;
}

/**
 * Pulls down peaks above `maxAmplitude`. Key `normalization` in `pluginFilters`.
 */
export interface ApiDspxNormalizationFilter {
  /** Peak limit, 0 to 1. 0 mutes the output. */
  maxAmplitude: number;
  /** Whether detected peaks carry over to later audio. */
  adaptive: boolean;
}

/**
 * Echo effect. Key `echo` in `pluginFilters`.
 */
export interface ApiDspxEchoFilter {
  /** Echo delay in seconds, above 0. */
  echoLength: number;
  /** 0 to 1. 1 means the echo never fades, 0 means no echo. */
  decay: number;
}

/**
 * All LavaDSPX filters, keyed the way they go into `pluginFilters`.
 *
 * Source: `devoxin/LavaDSPX-Plugin` README and `*FilterExtension.java`.
 */
export interface ApiDspxPluginFilters {
  /** High pass filter. */
  "high-pass"?: ApiDspxHighPassFilter;
  /** Low pass filter. */
  "low-pass"?: ApiDspxLowPassFilter;
  /** Normalization filter. */
  normalization?: ApiDspxNormalizationFilter;
  /** Echo filter. */
  echo?: ApiDspxEchoFilter;
}
