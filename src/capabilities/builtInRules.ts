import type { Capability } from "./Capability.js";
import type { CapabilityContext, CapabilityRule } from "./CapabilityRule.js";

/**
 * Plugin names as they appear in `/v4/info`, from each plugin's `lavalinkPlugin { name }`.
 */
export const LavalinkPluginName = {
  YouTube: "youtube-plugin",
  LavaSrc: "lavasrc-plugin",
  LavaSearch: "lavasearch-plugin",
  LavaLyrics: "lavalyrics-plugin",
  LyricsKt: "lyrics",
  SponsorBlock: "sponsorblock-plugin",
  DuncteBot: "DuncteBot-plugin",
  LavaDspx: "lavadspx-plugin",
} as const;

const NODELINK_BUILT_INS: readonly Capability[] = [
  "lyrics",
  "lyrics:live",
  "lyrics:nodelink",
  "sponsorblock",
  "sponsorblock:nodelink",
  "chapters",
  "nodelink:mixer",
  "nodelink:groups",
  "nodelink:gapless",
  "nodelink:crossfade",
  "nodelink:fading",
  "nodelink:loudness",
  "nodelink:audioLanguage",
  "nodelink:meaning",
  "nodelink:encode",
  "nodelink:stream",
  "nodelink:connection",
  "nodelink:voiceReceive",
  "nodelink:liveChat",
];

/**
 * Turns `/v4/info` lists into prefixed capabilities: `filter:*`, `source:*` and `plugin:*`.
 *
 * @param context - Node info.
 * @returns Prefixed capabilities.
 */
export const listedCapabilities: CapabilityRule = (context) => [
  ...context.filters.map((name): Capability => `filter:${name}`),
  ...context.sourceManagers.map((name): Capability => `source:${name}`),
  ...context.plugins.map((name): Capability => `plugin:${name}`),
];

/**
 * Capabilities a Lavalink node gets from its plugins and version.
 *
 * @param context - Node info.
 * @returns Capabilities.
 */
export const lavalinkCapabilities: CapabilityRule = (context) => {
  if (context.kind !== "lavalink") return [];
  const has = (name: string): boolean => context.plugins.includes(name);
  const found: Capability[] = [];
  if (has(LavalinkPluginName.LavaSearch)) found.push("search:lavasearch");
  if (has(LavalinkPluginName.LavaLyrics)) found.push("lyrics", "lyrics:live", "lyrics:lavalyrics");
  if (has(LavalinkPluginName.LyricsKt)) found.push("lyrics", "lyrics:lyricskt");
  if (has(LavalinkPluginName.SponsorBlock)) {
    found.push("sponsorblock", "sponsorblock:plugin", "chapters");
  }
  if (has(LavalinkPluginName.LavaDspx)) found.push("pluginFilter:lavadspx");
  if (supportsDave(context.version)) found.push("voice:dave");
  return found;
};

/**
 * Capabilities every NodeLink node has, plus source health when it's switched on.
 *
 * @param context - Node info.
 * @returns Capabilities.
 */
export const nodeLinkCapabilities: CapabilityRule = (context) => {
  if (context.kind !== "nodelink") return [];
  const found = [...NODELINK_BUILT_INS];
  if (sourceHealthEnabled(context.raw)) found.push("nodelink:sourceHealth");
  return found;
};

/**
 * Lavalink added DAVE in 4.2.0 (see its CHANGELOG).
 *
 * @param version - Server version.
 * @returns `true` for 4.2.0 and later.
 */
function supportsDave(version: CapabilityContext["version"]): boolean {
  return version.major > 4 || (version.major === 4 && version.minor >= 2);
}

function sourceHealthEnabled(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || !("sourceHealth" in raw)) return false;
  const { sourceHealth } = raw;
  return (
    typeof sourceHealth === "object" &&
    sourceHealth !== null &&
    "enabled" in sourceHealth &&
    sourceHealth.enabled === true
  );
}

/**
 * The rules Lunalink always runs, in order.
 */
export const builtInCapabilityRules: readonly CapabilityRule[] = [
  listedCapabilities,
  lavalinkCapabilities,
  nodeLinkCapabilities,
];
