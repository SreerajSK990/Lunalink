import type { ApiEventBase, ApiException, ApiTrack } from "../protocol/index.js";

/**
 * Which server software a node runs.
 */
export type NodeKind = "lavalink" | "nodelink";

/**
 * A server version, the same shape for Lavalink and NodeLink.
 */
export interface NodeVersion {
  /** Full version string. */
  semver: string;
  /** Major version. */
  major: number;
  /** Minor version. */
  minor: number;
  /** Patch version. */
  patch: number;
  /** Pre-release identifiers. Empty for stable releases. */
  preRelease: string[];
  /** Build metadata identifiers. */
  build: string[];
}

/**
 * A node's `/v4/info`, normalized so Lavalink and NodeLink look the same.
 */
export interface NodeInfo {
  /** Server software. */
  kind: NodeKind;
  /** Server version. */
  version: NodeVersion;
  /** Build time in Unix milliseconds. */
  buildTime: number;
  /** Runtime the server runs on: the JVM version for Lavalink, Node.js for NodeLink. */
  runtime: string;
  /** Enabled source managers. */
  sourceManagers: string[];
  /** Enabled filters. */
  filters: string[];
  /** Loaded server plugins. */
  plugins: { name: string; version: string }[];
  /** The body exactly as the server sent it. */
  raw: unknown;
}

/**
 * Node statistics, normalized. `cpu.serverLoad` is `lavalinkLoad` on Lavalink and
 * `nodelinkLoad` on NodeLink.
 */
export interface NodeStats {
  /** Players on the server. */
  players: number;
  /** Players that are playing something. */
  playingPlayers: number;
  /** Uptime in milliseconds. */
  uptime: number;
  /** Memory in bytes. */
  memory: { free: number; used: number; allocated: number; reservable: number };
  /** CPU usage, 0 to 1. */
  cpu: { cores: number; systemLoad: number; serverLoad: number };
  /** Audio frames for the last minute, when the server reported them. */
  frameStats: { sent: number; nulled: number; deficit: number } | null;
  /** The stats exactly as the server sent them. */
  raw: unknown;
}

/**
 * Why a track ended. `gapless` and `crossfading` only come from NodeLink and mean the next
 * track has already taken over.
 */
export type TrackEndReason =
  "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup" | "gapless" | "crossfading";

/**
 * A SponsorBlock segment, the same shape whichever server sent it.
 */
export interface SponsorBlockSegment {
  /** Category, for example `sponsor`. */
  category: string;
  /** Start in milliseconds. */
  start: number;
  /** End in milliseconds. */
  end: number;
  /** The segment as the server sent it. NodeLink's carries votes, uuid and more. */
  raw: unknown;
}

/**
 * A chapter of a YouTube video.
 */
export interface Chapter {
  /** Chapter title. */
  name: string;
  /** Start in milliseconds. */
  start: number;
  /** End in milliseconds, when known. */
  end: number | null;
  /** The chapter as the server sent it. */
  raw: unknown;
}

/**
 * One line of lyrics.
 */
export interface LyricsLine {
  /** The text. */
  text: string;
  /** Start in milliseconds. `null` for unsynced lyrics. */
  start: number | null;
  /** Length in milliseconds, when known. */
  duration: number | null;
}

/**
 * Lyrics, normalized across LavaLyrics, lyrics.kt and NodeLink.
 */
export interface Lyrics {
  /** Which backend found them. */
  backend: "lavalyrics" | "lyricskt" | "nodelink";
  /** Source that provided them, for example `spotify` or `genius`. */
  source: string | null;
  /** Provider credited by the source, when known. */
  provider: string | null;
  /** The full text. */
  text: string;
  /** Lines, timed when `synced` is true. */
  lines: LyricsLine[];
  /** Whether the lines carry real timings. */
  synced: boolean;
  /** The response exactly as the server sent it. */
  raw: unknown;
}

/**
 * A server event after the driver has normalized it.
 */
export type NodeEvent =
  | { type: "trackStart"; guildId: string; track: ApiTrack }
  | {
      type: "trackEnd";
      guildId: string;
      track: ApiTrack;
      reason: TrackEndReason;
      mayStartNext: boolean;
      handedOff: boolean;
    }
  | { type: "trackException"; guildId: string; track: ApiTrack; exception: ApiException }
  | { type: "trackStuck"; guildId: string; track: ApiTrack; thresholdMs: number }
  | { type: "voiceClosed"; guildId: string; code: number; reason: string; byRemote: boolean }
  | { type: "segmentsLoaded"; guildId: string; segments: SponsorBlockSegment[] }
  | { type: "segmentSkipped"; guildId: string; segment: SponsorBlockSegment }
  | { type: "chaptersLoaded"; guildId: string; chapters: Chapter[] }
  | { type: "chapterStarted"; guildId: string; chapter: Chapter }
  | { type: "lyricsFound"; guildId: string; lyrics: Lyrics }
  | { type: "lyricsNotFound"; guildId: string }
  | { type: "lyricsLine"; guildId: string; lineIndex: number; line: LyricsLine; skipped: boolean }
  | { type: "nodeLinkEvent"; guildId: string; name: string; payload: ApiEventBase }
  | { type: "unknown"; guildId: string; name: string; payload: ApiEventBase };

/**
 * Translates one server's wire format into Lunalink's. Lavalink and NodeLink each get one, so
 * the rest of the library never checks which server it's talking to.
 */
export interface NodeDriver {
  /** Server software this driver handles. */
  readonly kind: NodeKind;
  /**
   * Normalizes `/v4/info`.
   *
   * @param raw - Response body.
   * @returns Normalized info.
   * @throws {TypeError} When the body isn't a valid info response.
   */
  normalizeInfo(raw: unknown): NodeInfo;
  /**
   * Normalizes a `stats` message or `/v4/stats` body.
   *
   * @param raw - Stats body.
   * @returns Normalized stats, or `null` when the body is unusable.
   */
  normalizeStats(raw: unknown): NodeStats | null;
  /**
   * Normalizes an event message.
   *
   * @param raw - Event with `op: "event"`.
   * @returns The normalized event.
   */
  normalizeEvent(raw: ApiEventBase): NodeEvent;
}
