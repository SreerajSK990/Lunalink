import type { ApiException, JsonObject } from "../protocol/index.js";
import type { QueueItem } from "./QueueItem.js";
import type { Track } from "./Track.js";

/**
 * Playlist details on a playlist result.
 */
export interface PlaylistDetails {
  /** Playlist name. */
  name: string;
  /** Index of the track the link pointed at, or `-1`. */
  selectedTrack: number;
  /** Extra data from server plugins, for example LavaSrc's playlist author and artwork. */
  pluginInfo: Readonly<JsonObject>;
}

/**
 * What a search or link load returned. Node results hold {@link Track}s; `lunalink.search()`
 * can also return unresolved tracks from plugin resolvers, so check `kind` when it matters.
 *
 * - `track`: a link to one track.
 * - `playlist`: a playlist, album or similar; `playlist` is set.
 * - `search`: search results, best first.
 * - `empty`: nothing matched.
 * - `error`: loading failed; `error` explains why.
 */
export interface SearchResult<T extends QueueItem = Track> {
  /** What kind of result this is. */
  type: "track" | "playlist" | "search" | "empty" | "error";
  /** The tracks. Empty for `empty` and `error`. */
  tracks: T[];
  /** Playlist details for `playlist` results. */
  playlist: PlaylistDetails | null;
  /** What went wrong, for `error` results. */
  error: ApiException | null;
  /** Id of the node that answered, or `null` when a plugin resolver answered. */
  nodeId: string | null;
}
