import type { ApiEventBase } from "../../protocol/index.js";
import { normalizeCoreEvent } from "../shared/coreEvents.js";
import { normalizeInfo } from "../shared/normalizeInfo.js";
import { normalizeLyricsEvent } from "../shared/lyricsEvents.js";
import { normalizeSegment, normalizeSegments } from "../shared/normalizeSponsorBlock.js";
import { normalizeStats } from "../shared/normalizeStats.js";
import { readArray, readRecord } from "../shared/read.js";
import type { NodeDriver, NodeEvent, NodeInfo, NodeStats } from "../types.js";

const NODELINK_EVENTS: ReadonlySet<string> = new Set([
  "ConnectionStatusEvent",
  "VolumeChangedEvent",
  "FiltersChangedEvent",
  "SeekEvent",
  "PauseEvent",
  "PlayerCreatedEvent",
  "PlayerDestroyedEvent",
  "PlayerReconnectingEvent",
  "PlayerConnectedEvent",
  "MixStartedEvent",
  "MixEndedEvent",
  "EternalBoxInfoEvent",
  "EternalBoxJumpEvent",
  "StreamMetadataEvent",
  "SourceHealthSnapshotEvent",
  "SourceHealthChangeEvent",
  "WorkerFailedEvent",
]);

/**
 * Driver for NodeLink. It handles NodeLink's extra end reasons, its built-in SponsorBlock and
 * lyrics events, and passes every other NodeLink event through as `nodeLinkEvent`.
 */
export class NodeLinkDriver implements NodeDriver {
  /** Always `nodelink`. */
  readonly kind = "nodelink" as const;

  /**
   * Normalizes `/v4/info`.
   *
   * @param raw - Response body.
   * @returns Normalized info.
   */
  normalizeInfo(raw: unknown): NodeInfo {
    return normalizeInfo(raw, "nodelink", "node");
  }

  /**
   * Normalizes stats.
   *
   * @param raw - Stats body.
   * @returns Normalized stats.
   */
  normalizeStats(raw: unknown): NodeStats | null {
    return normalizeStats(raw, "nodelinkLoad");
  }

  /**
   * Normalizes an event.
   *
   * @param raw - Event message.
   * @returns The normalized event.
   */
  normalizeEvent(raw: ApiEventBase): NodeEvent {
    const known =
      normalizeCoreEvent(raw) ??
      normalizeSponsorBlockEvent(raw) ??
      normalizeLyricsEvent(raw, "nodelink");
    if (known) return known;
    const type = NODELINK_EVENTS.has(raw.type) ? "nodeLinkEvent" : "unknown";
    return { type, guildId: raw.guildId, name: raw.type, payload: raw };
  }
}

function normalizeSponsorBlockEvent(raw: ApiEventBase): NodeEvent | undefined {
  const { guildId } = raw;
  if (raw.type === "SponsorBlockSegmentsLoadedEvent") {
    return {
      type: "segmentsLoaded",
      guildId,
      segments: normalizeSegments(readArray(raw, "segments")),
    };
  }
  if (raw.type === "SponsorBlockSegmentSkippedEvent") {
    const segment = normalizeSegment(readRecord(raw, "segment"));
    return segment ? { type: "segmentSkipped", guildId, segment } : undefined;
  }
  return undefined;
}
