import type { JsonObject } from "./json.js";

/**
 * Metadata the server reports for a track.
 *
 * Mirrors `TrackInfo` in Lavalink's `protocol/v4/player.kt`.
 */
export interface ApiTrackInfo {
  /** Source-specific id, for example a YouTube video id. */
  identifier: string;
  /** Whether the server allows seeking in this track. */
  isSeekable: boolean;
  /** Artist, channel or uploader name. */
  author: string;
  /** Length in milliseconds. Live streams report a very large number. */
  length: number;
  /** Whether the track is a live stream. */
  isStream: boolean;
  /** Start position in milliseconds the server reports for this track. */
  position: number;
  /** Track title. */
  title: string;
  /** Link to the track, when the source has one. */
  uri: string | null;
  /** Name of the source manager that loaded it, for example `youtube` or `spotify`. */
  sourceName: string;
  /** Cover art or thumbnail link, when known. */
  artworkUrl: string | null;
  /** International Standard Recording Code, when known. */
  isrc: string | null;
}

/**
 * A playable track exactly as the server sends it.
 */
export interface ApiTrack {
  /** Base64 blob the server uses to play the track again. */
  encoded: string;
  /** Track metadata. */
  info: ApiTrackInfo;
  /** Extra data added by server plugins. Empty object when no plugin added anything. */
  pluginInfo: JsonObject;
  /** Data you attached through the update player endpoint, echoed back by the server. */
  userData: JsonObject;
}

/**
 * Playlist metadata from a load result.
 */
export interface ApiPlaylistInfo {
  /** Playlist name. */
  name: string;
  /** Index of the track the link pointed at, or `-1` when it pointed at the whole playlist. */
  selectedTrack: number;
}

/**
 * A playlist with its tracks.
 */
export interface ApiPlaylist {
  /** Playlist metadata. */
  info: ApiPlaylistInfo;
  /** Extra data added by server plugins. */
  pluginInfo: JsonObject;
  /** Tracks in playlist order. */
  tracks: ApiTrack[];
}

/**
 * How sure the server is about the cause of an exception.
 *
 * - `common`: an expected failure, such as a removed video.
 * - `suspicious`: probably an outside problem, such as a source returning something odd.
 * - `fault`: likely a server bug, or the cause is unknown.
 */
export type ApiExceptionSeverity = "common" | "suspicious" | "fault";

/**
 * An error the server attaches to failed loads and `TrackExceptionEvent`.
 */
export interface ApiException {
  /** Human readable message, when the server has one. */
  message: string | null;
  /** How sure the server is about the cause. */
  severity: ApiExceptionSeverity;
  /** Short description of the underlying cause. */
  cause: string;
  /** Full stack trace of the cause. */
  causeStackTrace: string;
}
