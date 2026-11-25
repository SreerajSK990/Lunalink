import type { ApiEventBase } from "../events.js";

/**
 * A SponsorBlock segment from the Lavalink SponsorBlock plugin.
 */
export interface ApiSponsorBlockSegment {
  /** Segment category, for example `sponsor` or `intro`. */
  category: string;
  /** Start in milliseconds. */
  start: number;
  /** End in milliseconds. */
  end: number;
}

/**
 * A YouTube chapter from the Lavalink SponsorBlock plugin.
 */
export interface ApiSponsorBlockChapter {
  /** Chapter title. */
  name: string;
  /** Start in milliseconds. */
  start: number;
  /** End in milliseconds. */
  end: number;
  /** Length in milliseconds. */
  duration: number;
}

/**
 * Segments were loaded for the current track.
 *
 * Source: `topi314/Sponsorblock-Plugin` `protocol/.../Events.kt`.
 */
export interface ApiSegmentsLoadedEvent extends ApiEventBase {
  /** Always `SegmentsLoaded`. */
  type: "SegmentsLoaded";
  /** The segments. */
  segments: ApiSponsorBlockSegment[];
}

/**
 * A segment was skipped.
 */
export interface ApiSegmentSkippedEvent extends ApiEventBase {
  /** Always `SegmentSkipped`. */
  type: "SegmentSkipped";
  /** The skipped segment. */
  segment: ApiSponsorBlockSegment;
}

/**
 * Chapters were loaded for the current track.
 */
export interface ApiChaptersLoadedEvent extends ApiEventBase {
  /** Always `ChaptersLoaded`. */
  type: "ChaptersLoaded";
  /** The chapters. */
  chapters: ApiSponsorBlockChapter[];
}

/**
 * Playback entered a new chapter.
 */
export interface ApiChapterStartedEvent extends ApiEventBase {
  /** Always `ChapterStarted`. */
  type: "ChapterStarted";
  /** The chapter that started. */
  chapter: ApiSponsorBlockChapter;
}

/**
 * Segment categories the SponsorBlock API knows about. Servers may accept more.
 */
export type ApiSponsorBlockCategory =
  | "sponsor"
  | "selfpromo"
  | "interaction"
  | "intro"
  | "outro"
  | "preview"
  | "music_offtopic"
  | "filler";
