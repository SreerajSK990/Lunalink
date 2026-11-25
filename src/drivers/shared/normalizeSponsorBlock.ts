import type { Chapter, SponsorBlockSegment } from "../types.js";
import { readNumber, readString } from "./read.js";

/**
 * Normalizes a segment. Both the Lavalink plugin and NodeLink use `category`, `start` and
 * `end`, so one function covers both; NodeLink's extra fields stay in `raw`.
 *
 * @param raw - Segment object.
 * @returns The segment, or `undefined` without a category.
 */
export function normalizeSegment(raw: unknown): SponsorBlockSegment | undefined {
  const category = readString(raw, "category");
  if (category === null) return undefined;
  return { category, start: readNumber(raw, "start"), end: readNumber(raw, "end"), raw };
}

/**
 * Normalizes a list of segments, dropping malformed entries.
 *
 * @param raw - Array of segments.
 * @returns Segments.
 */
export function normalizeSegments(raw: readonly unknown[]): SponsorBlockSegment[] {
  return raw
    .map(normalizeSegment)
    .filter((segment): segment is SponsorBlockSegment => segment !== undefined);
}

/**
 * Normalizes a chapter from the Lavalink SponsorBlock plugin (`name`, `start`, `end`) or from
 * NodeLink's `/v4/loadchapters` (`title`, `startTime`, `endTime`).
 *
 * @param raw - Chapter object.
 * @returns The chapter, or `undefined` without a title.
 */
export function normalizeChapter(raw: unknown): Chapter | undefined {
  const name = readString(raw, "name") ?? readString(raw, "title");
  if (name === null) return undefined;
  const start = readNumber(raw, "start", readNumber(raw, "startTime"));
  const endValue = readNumber(raw, "end", readNumber(raw, "endTime", Number.NaN));
  return { name, start, end: Number.isNaN(endValue) ? null : endValue, raw };
}

/**
 * Normalizes a list of chapters, dropping malformed entries.
 *
 * @param raw - Array of chapters.
 * @returns Chapters.
 */
export function normalizeChapters(raw: readonly unknown[]): Chapter[] {
  return raw.map(normalizeChapter).filter((chapter): chapter is Chapter => chapter !== undefined);
}
