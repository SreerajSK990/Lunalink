import type { ApiException, ApiPlaylist, ApiTrack } from "./track.js";

/**
 * The `loadType` values `GET /v4/loadtracks` can return.
 */
export type ApiLoadType = "track" | "playlist" | "search" | "empty" | "error";

/**
 * A single track was loaded, usually from a direct link.
 */
export interface ApiTrackLoadResult {
  /** Always `track`. */
  loadType: "track";
  /** The loaded track. */
  data: ApiTrack;
}

/**
 * A playlist or album was loaded.
 */
export interface ApiPlaylistLoadResult {
  /** Always `playlist`. */
  loadType: "playlist";
  /** The playlist and its tracks. */
  data: ApiPlaylist;
}

/**
 * A search prefix such as `ytsearch:` was used and returned results.
 */
export interface ApiSearchLoadResult {
  /** Always `search`. */
  loadType: "search";
  /** Matching tracks, best match first. */
  data: ApiTrack[];
}

/**
 * Nothing matched the identifier.
 */
export interface ApiEmptyLoadResult {
  /** Always `empty`. */
  loadType: "empty";
  /** Lavalink sends `null` here; some servers send an empty object. */
  data: null | Record<string, never>;
}

/**
 * Loading failed on the server.
 */
export interface ApiErrorLoadResult {
  /** Always `error`. */
  loadType: "error";
  /** What went wrong. */
  data: ApiException;
}

/**
 * Response body of `GET /v4/loadtracks`.
 */
export type ApiLoadResult =
  | ApiTrackLoadResult
  | ApiPlaylistLoadResult
  | ApiSearchLoadResult
  | ApiEmptyLoadResult
  | ApiErrorLoadResult;
