/**
 * One lyrics line from NodeLink's `/v4/loadlyrics`.
 */
export interface ApiNodeLinkLyricsLine {
  /** The line's text. */
  text: string;
  /** Start time in milliseconds. */
  time: number;
  /** Length in milliseconds. */
  duration: number;
  /** Word-level timing, when the source has it. The shape depends on the source. */
  words?: Record<string, unknown>[];
}

/**
 * Lyrics found by NodeLink.
 *
 * Source: `PerformanC/NodeLink` `src/managers/lyricsManager.ts` (`LyricsData`).
 */
export interface ApiNodeLinkLyricsData {
  /** Name the source gave the lyrics, often the song title. */
  name?: string;
  /** Whether `lines` carry real timings. */
  synced?: boolean;
  /** The lines. */
  lines?: ApiNodeLinkLyricsLine[];
  /** Lyrics provider credited by the source. */
  provider?: string;
  /** `captions` when the lines came from video subtitles. */
  kind?: "lyrics" | "captions";
  /** Where the song's intro ends, in milliseconds, when known. */
  introEndMs?: number;
  /** Where the song's outro starts, in milliseconds, when known. */
  outroStartMs?: number;
  /** Credit for the lyrics. */
  attribution?: { name: string; url: string; submitter?: { name: string; url: string } };
}

/**
 * Response of `GET /v4/loadlyrics`.
 */
export type ApiNodeLinkLyricsResult =
  | { loadType: "lyrics"; data: ApiNodeLinkLyricsData }
  | { loadType: "empty"; data: Record<string, never> }
  | { loadType: "error"; data: { message: string; severity: string } };

/**
 * One line in a NodeLink `LyricsFoundEvent` or `LyricsLineEvent`.
 *
 * Source: `src/typings/playback/player.types.ts` (`LyricsLine`).
 */
export interface ApiNodeLinkLiveLyricsLine {
  /** Start time in milliseconds. */
  timestamp: number;
  /** Length in milliseconds. */
  duration: number;
  /** The line's text. */
  line: string;
  /** Word-level timing. */
  words: Record<string, unknown>[];
  /** Extra source data. */
  plugin: Record<string, unknown>;
}

/**
 * Lyrics in a NodeLink `LyricsFoundEvent`. Same field names LavaLyrics uses.
 */
export interface ApiNodeLinkLiveLyrics {
  /** Source that found the lyrics. */
  sourceName: string;
  /** Lyrics provider. */
  provider: string;
  /** Full text. */
  text: string;
  /** Timed lines. */
  lines: ApiNodeLinkLiveLyricsLine[];
  /** Extra source data. */
  plugin: Record<string, unknown>;
}
