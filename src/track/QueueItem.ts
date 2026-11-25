import type { Track } from "./Track.js";
import type { UnresolvedTrack } from "./UnresolvedTrack.js";

/**
 * Anything that can go in a queue: a playable track or one that is resolved right before it plays.
 */
export type QueueItem = Track | UnresolvedTrack;
