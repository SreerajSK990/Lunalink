import { isRecord } from "../../utils/guards.js";
import type { NodeStats } from "../types.js";
import { readNumber, readRecord } from "./read.js";

/**
 * Normalizes a stats body. The only difference between servers is the name of the server load
 * field, which is passed in.
 *
 * @param raw - Stats body.
 * @param loadKey - `lavalinkLoad` or `nodelinkLoad`.
 * @returns Normalized stats, or `null` when `raw` isn't an object.
 */
export function normalizeStats(raw: unknown, loadKey: string): NodeStats | null {
  if (!isRecord(raw)) return null;
  const memory = readRecord(raw, "memory");
  const cpu = readRecord(raw, "cpu");
  const frames = readRecord(raw, "frameStats");
  return {
    players: readNumber(raw, "players"),
    playingPlayers: readNumber(raw, "playingPlayers"),
    uptime: readNumber(raw, "uptime"),
    memory: {
      free: readNumber(memory, "free"),
      used: readNumber(memory, "used"),
      allocated: readNumber(memory, "allocated"),
      reservable: readNumber(memory, "reservable"),
    },
    cpu: {
      cores: readNumber(cpu, "cores", 1),
      systemLoad: readNumber(cpu, "systemLoad"),
      serverLoad: readNumber(cpu, loadKey),
    },
    frameStats: frames
      ? {
          sent: readNumber(frames, "sent"),
          nulled: readNumber(frames, "nulled"),
          deficit: readNumber(frames, "deficit"),
        }
      : null,
    raw,
  };
}
