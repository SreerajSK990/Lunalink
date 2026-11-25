import type { ApiEventBase } from "../events.js";
import type { JsonObject } from "../json.js";

/**
 * One timed line of lyrics from LavaLyrics.
 */
export interface ApiLavaLyricsLine {
  /** When the line starts, in milliseconds. */
  timestamp: number;
  /** How long the line lasts in milliseconds, when known. */
  duration: number | null;
  /** The line's text. */
  line: string;
  /** Extra data from the lyrics source. */
  plugin: JsonObject;
}

/**
 * Lyrics as returned by LavaLyrics.
 *
 * Source: `topi314/LavaLyrics` `protocol/.../Lyrics.kt`.
 */
export interface ApiLavaLyrics {
  /** Source that provided the lyrics, for example `spotify` or `youtube`. */
  sourceName: string;
  /** Lyrics provider credited by the source, when known. */
  provider: string | null;
  /** Plain lyrics text, when the source has it. */
  text: string | null;
  /** Timed lines, when the source has them. */
  lines: ApiLavaLyricsLine[] | null;
  /** Extra data from the lyrics source. */
  plugin: JsonObject;
}

/**
 * LavaLyrics found lyrics for the current track of a subscribed player.
 */
export interface ApiLyricsFoundEvent extends ApiEventBase {
  /** Always `LyricsFoundEvent`. */
  type: "LyricsFoundEvent";
  /** The lyrics. */
  lyrics: ApiLavaLyrics;
}

/**
 * LavaLyrics found no lyrics for the current track of a subscribed player.
 */
export interface ApiLyricsNotFoundEvent extends ApiEventBase {
  /** Always `LyricsNotFoundEvent`. */
  type: "LyricsNotFoundEvent";
}

/**
 * The playing position reached a new lyrics line.
 */
export interface ApiLyricsLineEvent extends ApiEventBase {
  /** Always `LyricsLineEvent`. */
  type: "LyricsLineEvent";
  /** Index of the line in the lyrics. */
  lineIndex: number;
  /** The line. */
  line: ApiLavaLyricsLine;
  /** Whether lines were skipped to get here, for example after a seek. */
  skipped: boolean;
}
