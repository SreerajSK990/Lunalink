/**
 * Album art returned by lyrics.kt.
 */
export interface ApiLyricsKtAlbumArt {
  /** Image link. */
  url: string;
  /** Height in pixels. */
  height: number;
  /** Width in pixels. */
  width: number;
}

/**
 * The song lyrics.kt matched.
 */
export interface ApiLyricsKtTrack {
  /** Song title. */
  title: string;
  /** Artist. */
  author: string;
  /** Album, when known. */
  album: string | null;
  /** Album art in several sizes. */
  albumArt: ApiLyricsKtAlbumArt[];
}

/**
 * One timed line from lyrics.kt.
 */
export interface ApiLyricsKtLine {
  /** The line's text. */
  line: string;
  /** Start and end of the line in milliseconds, when known. */
  range: { start: number; end: number } | null;
}

/**
 * Timed lyrics from lyrics.kt.
 */
export interface ApiLyricsKtTimedLyrics {
  /** Always `timed`. */
  type: "timed";
  /** The matched song. */
  track: ApiLyricsKtTrack;
  /** Lyrics source name. */
  source: string;
  /** Timed lines. */
  lines: ApiLyricsKtLine[];
}

/**
 * Plain text lyrics from lyrics.kt.
 */
export interface ApiLyricsKtTextLyrics {
  /** Always `text`. */
  type: "text";
  /** The matched song. */
  track: ApiLyricsKtTrack;
  /** Lyrics source name. */
  source: string;
  /** The lyrics. */
  text: string;
}

/**
 * Response of the lyrics.kt endpoints that return lyrics.
 *
 * Source: `DRSchlaubi/lyrics.kt` `protocol/src/commonMain/kotlin/Protocol.kt`.
 */
export type ApiLyricsKtLyrics = ApiLyricsKtTimedLyrics | ApiLyricsKtTextLyrics;

/**
 * One result of `GET /v4/lyrics/search/{query}`.
 */
export interface ApiLyricsKtSearchTrack {
  /** YouTube video id to pass to `GET /v4/lyrics/{videoId}`. */
  videoId: string;
  /** Song title. */
  title: string;
}
