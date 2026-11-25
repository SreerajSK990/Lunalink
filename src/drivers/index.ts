import { LavalinkDriver } from "./lavalink/LavalinkDriver.js";
import { NodeLinkDriver } from "./nodelink/NodeLinkDriver.js";
import type { NodeDriver, NodeKind } from "./types.js";

export type {
  Chapter,
  Lyrics,
  LyricsLine,
  NodeDriver,
  NodeEvent,
  NodeInfo,
  NodeKind,
  NodeStats,
  NodeVersion,
  SponsorBlockSegment,
  TrackEndReason,
} from "./types.js";
export { LavalinkDriver } from "./lavalink/LavalinkDriver.js";
export { NodeLinkDriver } from "./nodelink/NodeLinkDriver.js";
export { detectKind } from "./detectKind.js";
export {
  normalizeLavaLyrics,
  normalizeLyricsKt,
  normalizeNodeLinkLyrics,
} from "./shared/normalizeLyrics.js";
export { normalizeChapters, normalizeSegments } from "./shared/normalizeSponsorBlock.js";

/**
 * Returns the driver for a server kind.
 *
 * @param kind - `lavalink` or `nodelink`.
 * @returns A driver instance.
 */
export function driverFor(kind: NodeKind): NodeDriver {
  return kind === "nodelink" ? new NodeLinkDriver() : new LavalinkDriver();
}
