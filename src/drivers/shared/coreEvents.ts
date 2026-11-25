import type { ApiEventBase, ApiException, ApiTrack } from "../../protocol/index.js";
import { isRecord } from "../../utils/guards.js";
import type { NodeEvent, TrackEndReason } from "../types.js";
import { looksLikeTrack, readNumber, readString } from "./read.js";

const END_REASONS: ReadonlySet<string> = new Set<TrackEndReason>([
  "finished",
  "loadFailed",
  "stopped",
  "replaced",
  "cleanup",
  "gapless",
  "crossfading",
]);

const MAY_START_NEXT: ReadonlySet<TrackEndReason> = new Set(["finished", "loadFailed"]);
const HANDED_OFF: ReadonlySet<TrackEndReason> = new Set(["gapless", "crossfading"]);

/**
 * Normalizes the five events every v4 server sends. Returns `undefined` for anything else, or
 * when a required field is missing, so the driver can try its own events next.
 *
 * @param raw - Event message.
 * @returns The normalized event, or `undefined`.
 */
export function normalizeCoreEvent(raw: ApiEventBase): NodeEvent | undefined {
  const event = raw as ApiEventBase & Record<string, unknown>;
  const { guildId } = raw;
  const track = event["track"];

  switch (raw.type) {
    case "TrackStartEvent":
      return looksLikeTrack(track)
        ? { type: "trackStart", guildId, track: track as ApiTrack }
        : undefined;
    case "TrackEndEvent": {
      const reasonText = readString(event, "reason");
      if (!looksLikeTrack(track) || reasonText === null || !END_REASONS.has(reasonText)) {
        return undefined;
      }
      const reason = reasonText as TrackEndReason;
      return {
        type: "trackEnd",
        guildId,
        track: track as ApiTrack,
        reason,
        mayStartNext: MAY_START_NEXT.has(reason),
        handedOff: HANDED_OFF.has(reason),
      };
    }
    case "TrackExceptionEvent":
      return looksLikeTrack(track) && isRecord(event["exception"])
        ? {
            type: "trackException",
            guildId,
            track: track as ApiTrack,
            exception: event["exception"] as unknown as ApiException,
          }
        : undefined;
    case "TrackStuckEvent":
      return looksLikeTrack(track)
        ? {
            type: "trackStuck",
            guildId,
            track: track as ApiTrack,
            thresholdMs: readNumber(event, "thresholdMs"),
          }
        : undefined;
    case "WebSocketClosedEvent":
      return {
        type: "voiceClosed",
        guildId,
        code: readNumber(event, "code"),
        reason: readString(event, "reason") ?? "",
        byRemote: event["byRemote"] === true,
      };
    default:
      return undefined;
  }
}
