import type { ApiEventBase } from "../../protocol/index.js";
import type { NodeEvent } from "../types.js";
import { normalizeLavaLyrics, normalizeTimestampLine } from "./normalizeLyrics.js";
import { readNumber, readRecord } from "./read.js";

/**
 * Normalizes the three live lyrics events. LavaLyrics and NodeLink use the same event names
 * and the same line shape.
 *
 * @param raw - Event message.
 * @param backend - Which backend sent it.
 * @returns The normalized event, or `undefined` for other event types.
 */
export function normalizeLyricsEvent(
  raw: ApiEventBase,
  backend: "lavalyrics" | "nodelink",
): NodeEvent | undefined {
  const { guildId } = raw;
  switch (raw.type) {
    case "LyricsFoundEvent": {
      const lyrics = readRecord(raw, "lyrics");
      return lyrics
        ? { type: "lyricsFound", guildId, lyrics: normalizeLavaLyrics(lyrics, backend) }
        : undefined;
    }
    case "LyricsNotFoundEvent":
      return { type: "lyricsNotFound", guildId };
    case "LyricsLineEvent": {
      const line = normalizeTimestampLine(readRecord(raw, "line"));
      if (!line) return undefined;
      return {
        type: "lyricsLine",
        guildId,
        lineIndex: readNumber(raw, "lineIndex"),
        line,
        skipped: (raw as ApiEventBase & { skipped?: unknown }).skipped === true,
      };
    }
    default:
      return undefined;
  }
}
