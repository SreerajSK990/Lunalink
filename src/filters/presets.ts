import type { ApiEqualizerBand } from "../protocol/index.js";
import type { FilterPreset } from "./types.js";

function bands(gains: readonly number[]): ApiEqualizerBand[] {
  return gains.map((gain, band) => ({ band, gain }));
}

/**
 * The presets Lunalink ships with. They only use Lavalink v4 core filters, so they work on
 * every node. The values are common community settings, not something the servers define.
 */
export const builtInPresets: readonly FilterPreset[] = [
  {
    name: "nightcore",
    description: "Faster and higher pitched.",
    filters: { timescale: { speed: 1.25, pitch: 1.25, rate: 1 } },
  },
  {
    name: "vaporwave",
    description: "Slower and lower pitched.",
    filters: { timescale: { speed: 0.85, pitch: 0.8, rate: 1 } },
  },
  {
    name: "daycore",
    description: "Slightly slower and lower.",
    filters: { timescale: { speed: 0.9, pitch: 0.9, rate: 1 } },
  },
  {
    name: "8d",
    description: "Sound circles around your head.",
    filters: { rotation: { rotationHz: 0.2 } },
  },
  {
    name: "karaoke",
    description: "Cuts most vocals.",
    filters: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } },
  },
  {
    name: "bassboost",
    description: "Stronger bass.",
    filters: { equalizer: bands([0.25, 0.2, 0.15, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
  },
  {
    name: "treble",
    description: "Brighter highs.",
    filters: { equalizer: bands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.1, 0.15, 0.2, 0.2, 0.2]) },
  },
  {
    name: "pop",
    description: "Lifted mids for vocals.",
    filters: {
      equalizer: bands([-0.05, 0, 0.05, 0.1, 0.15, 0.15, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0]),
    },
  },
  {
    name: "soft",
    description: "Muffled, like music in the next room.",
    filters: { lowPass: { smoothing: 20 } },
  },
  {
    name: "tremolo",
    description: "Volume wobble.",
    filters: { tremolo: { frequency: 4, depth: 0.75 } },
  },
  {
    name: "vibrato",
    description: "Pitch wobble.",
    filters: { vibrato: { frequency: 4, depth: 0.75 } },
  },
  {
    name: "mono",
    description: "Both ears hear the same thing.",
    filters: {
      channelMix: { leftToLeft: 0.5, leftToRight: 0.5, rightToLeft: 0.5, rightToRight: 0.5 },
    },
  },
];
