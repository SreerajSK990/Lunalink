/**
 * Named capabilities Lunalink derives from a node's `/v4/info`. Besides these, every enabled
 * filter shows up as `filter:<name>`, every source as `source:<name>`, and every server plugin
 * as `plugin:<name>`.
 */
export type KnownCapability =
  | "search:lavasearch"
  | "lyrics"
  | "lyrics:live"
  | "lyrics:lavalyrics"
  | "lyrics:lyricskt"
  | "lyrics:nodelink"
  | "sponsorblock"
  | "sponsorblock:plugin"
  | "sponsorblock:nodelink"
  | "chapters"
  | "pluginFilter:lavadspx"
  | "voice:dave"
  | "nodelink:mixer"
  | "nodelink:groups"
  | "nodelink:gapless"
  | "nodelink:crossfade"
  | "nodelink:fading"
  | "nodelink:loudness"
  | "nodelink:audioLanguage"
  | "nodelink:meaning"
  | "nodelink:encode"
  | "nodelink:stream"
  | "nodelink:connection"
  | "nodelink:sourceHealth"
  | "nodelink:voiceReceive"
  | "nodelink:liveChat";

/**
 * Any capability string. Known ones autocomplete; prefixed ones such as `filter:echo` and
 * custom ones added by plugins are allowed too.
 */
export type Capability =
  | KnownCapability
  | `filter:${string}`
  | `source:${string}`
  | `plugin:${string}`
  | (string & Record<never, never>);
