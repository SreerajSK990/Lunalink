import type { ApiEventBase } from "../../protocol/index.js";
import { normalizeCoreEvent } from "../shared/coreEvents.js";
import { normalizeInfo } from "../shared/normalizeInfo.js";
import { normalizeLyricsEvent } from "../shared/lyricsEvents.js";
import {
  normalizeChapter,
  normalizeSegment,
  normalizeSegments,
} from "../shared/normalizeSponsorBlock.js";
import { normalizeStats } from "../shared/normalizeStats.js";
import { readArray, readRecord } from "../shared/read.js";
import type { NodeDriver, NodeEvent, NodeInfo, NodeStats } from "../types.js";

/**
 * Driver for Lavalink v4. Besides the core events it understands the SponsorBlock plugin
 * (`SegmentsLoaded`, `SegmentSkipped`, `ChaptersLoaded`, `ChapterStarted`) and LavaLyrics.
 */
export class LavalinkDriver implements NodeDriver {
  /** Always `lavalink`. */
  readonly kind = "lavalink" as const;

  /**
   * Normalizes `/v4/info`.
   *
   * @param raw - Response body.
   * @returns Normalized info.
   */
  normalizeInfo(raw: unknown): NodeInfo {
    return normalizeInfo(raw, "lavalink", "jvm");
  }

  /**
   * Normalizes stats.
   *
   * @param raw - Stats body.
   * @returns Normalized stats.
   */
  normalizeStats(raw: unknown): NodeStats | null {
    return normalizeStats(raw, "lavalinkLoad");
  }

  /**
   * Normalizes an event.
   *
   * @param raw - Event message.
   * @returns The normalized event.
   */
  normalizeEvent(raw: ApiEventBase): NodeEvent {
    return (
      normalizeCoreEvent(raw) ??
      normalizeSponsorBlockPluginEvent(raw) ??
      normalizeLyricsEvent(raw, "lavalyrics") ?? {
        type: "unknown",
        guildId: raw.guildId,
        name: raw.type,
        payload: raw,
      }
    );
  }
}

function normalizeSponsorBlockPluginEvent(raw: ApiEventBase): NodeEvent | undefined {
  const { guildId } = raw;
  switch (raw.type) {
    case "SegmentsLoaded":
      return {
        type: "segmentsLoaded",
        guildId,
        segments: normalizeSegments(readArray(raw, "segments")),
      };
    case "SegmentSkipped": {
      const segment = normalizeSegment(readRecord(raw, "segment"));
      return segment ? { type: "segmentSkipped", guildId, segment } : undefined;
    }
    case "ChaptersLoaded":
      return {
        type: "chaptersLoaded",
        guildId,
        chapters: readArray(raw, "chapters")
          .map(normalizeChapter)
          .filter((chapter) => chapter !== undefined),
      };
    case "ChapterStarted": {
      const chapter = normalizeChapter(readRecord(raw, "chapter"));
      return chapter ? { type: "chapterStarted", guildId, chapter } : undefined;
    }
    default:
      return undefined;
  }
}
