import type { ApiTrack } from "../track.js";

/**
 * A chapter from `GET /v4/loadchapters`.
 *
 * Source: `src/typings/sources/youtubeClient.types.ts` (`Chapter`).
 */
export interface ApiNodeLinkChapter {
  /** Chapter title. */
  title: string;
  /** Start in milliseconds. */
  startTime: number;
  /** Chapter thumbnails. */
  thumbnails: { url: string; width?: number; height?: number }[];
  /** Length in milliseconds, when known. */
  duration?: number;
  /** End in milliseconds, when known. */
  endTime?: number;
}

/**
 * A song meaning from `GET /v4/meaning`.
 *
 * Source: `src/typings/meanings/meaning.types.ts` (`MeaningData`).
 */
export interface ApiNodeLinkMeaning {
  /** Title of the explanation. */
  title: string | null;
  /** Short summary. */
  description: string | null;
  /** The explanation, split into paragraphs. */
  paragraphs: string[];
  /** Translation, when a language was requested. */
  translation: {
    language: { source: string; target: string };
    title: string | null;
    description: string | null;
    paragraphs: string[];
  } | null;
  /** Link to the source page. */
  url: string;
  /** Whether this explains the track or the artist. */
  type: "track" | "artist";
  /** Song the meaning was matched to. */
  song: {
    title: string | null;
    artist: string | null;
    youtubeId: string | null;
    artworkUrl: string | null;
  };
  /** Source that provided it. */
  provider?: string;
}

/**
 * Response of `GET /v4/meaning`.
 */
export type ApiNodeLinkMeaningResult =
  | { loadType: "meaning"; data: ApiNodeLinkMeaning }
  | { loadType: "empty"; data: Record<string, never> }
  | { loadType: "error"; data: { message: string; severity: string } };

/**
 * Track info NodeLink can turn into an encoded track, with `GET /v4/encodetrack` or
 * `POST /v4/encodedtracks`.
 *
 * Source: `src/api/encodeTrack.ts` (`isTrackEncodeInput`).
 */
export interface ApiNodeLinkEncodeInput {
  /** Title. */
  title: string;
  /** Author. */
  author: string;
  /** Length in milliseconds. */
  length: number;
  /** Source-specific id. */
  identifier: string;
  /** Whether it's a live stream. */
  isStream: boolean;
  /** Link, or `null`. */
  uri: string | null;
  /** Artwork link, or `null`. */
  artworkUrl: string | null;
  /** ISRC, or `null`. */
  isrc: string | null;
  /** Source manager name. */
  sourceName: string;
  /** Start position in milliseconds. */
  position: number;
  /** Source-specific extra fields, in order. Use an empty array when there are none. */
  details: (string | null)[];
}

/**
 * A mix layer playing on top of the main track.
 *
 * Source: `src/api/sessions.id.players.id.mix.ts`.
 */
export interface ApiNodeLinkMixLayer {
  /** Layer id. */
  id: string;
  /** Track in this layer. */
  track: ApiTrack;
  /** Layer volume, 0 to 1. */
  volume: number;
  /** Position in the layer's track in milliseconds. Only in `GET` responses. */
  position?: number;
  /** When the layer started, in Unix milliseconds. Only in `GET` responses. */
  startTime?: number;
}

/**
 * NodeLink's built-in SponsorBlock segment. Carries more detail than the Lavalink plugin's.
 *
 * Source: `src/typings/playback/player.types.ts` (`SponsorBlockSegment`).
 */
export interface ApiNodeLinkSponsorBlockSegment {
  /** Segment id on the SponsorBlock API. */
  uuid: string;
  /** Start in milliseconds. */
  start: number;
  /** End in milliseconds. */
  end: number;
  /** Category, for example `sponsor`. */
  category: string;
  /** What the server does with it, for example `skip`. */
  actionType: string;
  /** Community votes. */
  votes: number;
  /** Whether moderators locked the segment. */
  locked: boolean;
  /** Video length SponsorBlock had on record. */
  videoDuration: number;
  /** Segment description. */
  description: string;
}

/**
 * State returned by `GET` and `PATCH` on `/v4/sessions/{sessionId}/players/{guildId}/sponsorblock`.
 *
 * Source: `src/typings/playback/player.types.ts` (`PlayerSponsorBlockState`).
 */
export interface ApiNodeLinkSponsorBlockState {
  /** Whether skipping is on for this player. */
  enabled: boolean;
  /** Categories that are skipped. */
  categories: string[];
  /** Action types that are acted on. */
  actionTypes: string[];
  /** Segments loaded for the current track. */
  segments: ApiNodeLinkSponsorBlockSegment[];
  /** Last skipped segment's id. */
  lastSkippedUuid: string | null;
  /** How close to a segment start a skip still triggers, in milliseconds. */
  skipMarginMs: number;
}

/**
 * Body of `PATCH /v4/sessions/{sessionId}/players/{guildId}/sponsorblock`.
 */
export interface ApiNodeLinkSponsorBlockUpdate {
  /** Turn skipping on or off. */
  enabled?: boolean;
  /** Categories to skip. */
  categories?: string[];
  /** Action types to act on. */
  actionTypes?: string[];
  /** Skip margin in milliseconds. */
  skipMarginMs?: number;
}

/**
 * Network quality NodeLink measured.
 */
export type ApiNodeLinkConnectionStatus = "unknown" | "good" | "average" | "bad" | "disconnected";

/**
 * Response of `GET /v4/connection`. `metrics` holds the last speed test; its fields depend on the
 * NodeLink version, so it's left open.
 *
 * Source: `src/api/connection.ts`, `src/typings/voice/connection.types.ts`.
 */
export interface ApiNodeLinkConnection {
  /** Quality classification. */
  status: ApiNodeLinkConnectionStatus;
  /** Last measurement. */
  metrics: { timestamp: number; [key: string]: unknown };
}
