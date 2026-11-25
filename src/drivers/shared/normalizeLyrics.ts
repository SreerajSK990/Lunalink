import { isRecord } from "../../utils/guards.js";
import type { Lyrics, LyricsLine } from "../types.js";
import { readArray, readNumber, readRecord, readString } from "./read.js";

/**
 * Normalizes one line in LavaLyrics' shape, which NodeLink's live lyrics events also use:
 * `{ timestamp, duration, line }`.
 *
 * @param raw - Line object.
 * @returns The line, or `undefined` when it has no text.
 */
export function normalizeTimestampLine(raw: unknown): LyricsLine | undefined {
  const text = readString(raw, "line");
  if (text === null) return undefined;
  const duration = isRecord(raw) && typeof raw["duration"] === "number" ? raw["duration"] : null;
  return { text, start: readNumber(raw, "timestamp"), duration };
}

/**
 * Normalizes lyrics in LavaLyrics' shape. NodeLink's `LyricsFoundEvent` uses the same shape.
 *
 * @param raw - Lyrics object.
 * @param backend - Which backend sent it.
 * @returns Normalized lyrics.
 */
export function normalizeLavaLyrics(raw: unknown, backend: "lavalyrics" | "nodelink"): Lyrics {
  const lines = readArray(raw, "lines")
    .map(normalizeTimestampLine)
    .filter((line): line is LyricsLine => line !== undefined);
  const text = readString(raw, "text") ?? lines.map((line) => line.text).join("\n");
  return {
    backend,
    source: readString(raw, "sourceName"),
    provider: readString(raw, "provider"),
    text,
    lines,
    synced: lines.length > 0,
    raw,
  };
}

/**
 * Normalizes a lyrics.kt response, which is either `timed` or `text`.
 *
 * @param raw - lyrics.kt body.
 * @returns Normalized lyrics.
 */
export function normalizeLyricsKt(raw: unknown): Lyrics {
  const source = readString(raw, "source");
  if (readString(raw, "type") === "timed") {
    const lines = readArray(raw, "lines").flatMap((line): LyricsLine[] => {
      const text = readString(line, "line");
      if (text === null) return [];
      const range = readRecord(line, "range");
      const start = range ? readNumber(range, "start") : null;
      const end = range ? readNumber(range, "end") : null;
      return [{ text, start, duration: start !== null && end !== null ? end - start : null }];
    });
    return {
      backend: "lyricskt",
      source,
      provider: null,
      text: lines.map((line) => line.text).join("\n"),
      lines,
      synced: true,
      raw,
    };
  }
  const text = readString(raw, "text") ?? "";
  return {
    backend: "lyricskt",
    source,
    provider: null,
    text,
    lines: text.split("\n").map((line) => ({ text: line, start: null, duration: null })),
    synced: false,
    raw,
  };
}

/**
 * Normalizes the `data` of NodeLink's `/v4/loadlyrics` result.
 *
 * @param raw - The `data` object of a `lyrics` result.
 * @returns Normalized lyrics.
 */
export function normalizeNodeLinkLyrics(raw: unknown): Lyrics {
  const synced = isRecord(raw) && raw["synced"] === true;
  const lines = readArray(raw, "lines").flatMap((line): LyricsLine[] => {
    const text = readString(line, "text");
    if (text === null) return [];
    return [
      {
        text,
        start: synced ? readNumber(line, "time") : null,
        duration: synced ? readNumber(line, "duration") : null,
      },
    ];
  });
  return {
    backend: "nodelink",
    source: readString(raw, "name"),
    provider: readString(raw, "provider"),
    text: lines.map((line) => line.text).join("\n"),
    lines,
    synced,
    raw,
  };
}
