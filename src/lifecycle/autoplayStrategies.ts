import type { Node } from "../node/Node.js";
import { recommendationPrefixes } from "../search/index.js";
import type { Track } from "../track/Track.js";

/**
 * What an autoplay strategy gets to work with.
 */
export interface AutoplayContext {
  /** The track that just finished. */
  lastTrack: Track;
  /** Node the player is on. */
  node: Node;
}

/**
 * One way to find related tracks. Strategies run in order, and the first one that returns tracks
 * the player hasn't just played wins.
 */
export interface AutoplayStrategy {
  /** Name shown in debug messages. */
  readonly name: string;
  /**
   * Builds the identifiers to load for this seed track.
   *
   * @param context - The finished track and the node.
   * @returns Identifiers to pass to `loadTracks`, or `null` when this strategy doesn't apply.
   */
  identifiers(context: AutoplayContext): readonly string[] | null;
}

/**
 * Recommendations from the same source as the seed track, through the LavaSrc and NodeLink
 * `<prefix>:<trackId>` terms (`sprec`, `dzrec`, `tdrec`, `qbrec`, `ymrec`, `vkrec`, `jsrec`).
 * Skipped when the node doesn't have that source.
 */
export const sameSourceRecommendations: AutoplayStrategy = {
  name: "sameSource",
  identifiers: ({ lastTrack, node }) => {
    const prefix = recommendationPrefixes[lastTrack.sourceName];
    if (!prefix || !node.supports(`source:${lastTrack.sourceName}`)) return null;
    return [`${prefix}:${lastTrack.identifier}`];
  },
};

/**
 * YouTube related tracks for a YouTube seed: the `RD` mix playlist on Lavalink and `ytrec:` on
 * NodeLink.
 */
export const youtubeMix: AutoplayStrategy = {
  name: "youtubeMix",
  identifiers: ({ lastTrack, node }) => {
    if (lastTrack.sourceName !== "youtube" || !node.supports("source:youtube")) return null;
    const id = lastTrack.identifier;
    return node.kind === "nodelink"
      ? [`ytrec:${id}`]
      : [`https://www.youtube.com/watch?v=${id}&list=RD${id}`];
  },
};

/**
 * Last resort: searches YouTube for "author - title".
 */
export const youtubeSearchFallback: AutoplayStrategy = {
  name: "youtubeSearch",
  identifiers: ({ lastTrack, node }) => {
    if (!node.supports("source:youtube")) return null;
    return [`ytsearch:${lastTrack.author} - ${lastTrack.title}`];
  },
};

/**
 * The built-in chain: same-source recommendations, then the YouTube mix, then a YouTube search.
 */
export const defaultAutoplayStrategies: readonly AutoplayStrategy[] = [
  sameSourceRecommendations,
  youtubeMix,
  youtubeSearchFallback,
];
