import type { JsonObject } from "../json.js";
import type { ApiPlaylist, ApiTrack } from "../track.js";

/**
 * Result types you can ask LavaSearch for with the `types` query parameter.
 */
export type ApiLavaSearchType = "track" | "playlist" | "album" | "artist" | "text";

/**
 * A text suggestion from LavaSearch.
 */
export interface ApiLavaSearchText {
  /** Suggested text. */
  text: string;
  /** Extra data from the source plugin. */
  plugin: JsonObject;
}

/**
 * Response of `GET /v4/loadsearch`. The server answers 204 with no body when nothing matched.
 *
 * Source: `topi314/LavaSearch` `protocol/.../SearchResult.kt`.
 */
export interface ApiLavaSearchResult {
  /** Matching tracks. */
  tracks: ApiTrack[];
  /** Matching albums. */
  albums: ApiPlaylist[];
  /** Matching artists, each with their top tracks. */
  artists: ApiPlaylist[];
  /** Matching playlists. */
  playlists: ApiPlaylist[];
  /** Text suggestions. */
  texts: ApiLavaSearchText[];
  /** Extra data from the source plugin. */
  plugin: JsonObject;
}
