import type { Player } from "../player/Player.js";
import type { ApiPlayer } from "../protocol/index.js";
import {
  type ResumeInfo,
  type ResumeStrategy,
  restartPosition,
  SEEK_THRESHOLD_MS,
} from "./resumeMath.js";

/**
 * What {@link resumeLive} knows about a node that came back.
 */
export interface LiveResumeContext {
  /** The server's copy of the player, or `null` when it has none. */
  server: ApiPlayer | null;
  /** Whether the session survived. */
  resumed: boolean;
  /** Whether a `WebSocketClosedEvent` arrived while the node was away. */
  voiceDropped: boolean;
  /** When the node went away, in Unix milliseconds. */
  since: number;
  /** The player's position when the node went away. */
  positionAtLoss: number;
  /** Strategy. */
  strategy: ResumeStrategy;
  /** Rewind lead. */
  rewindLeadMs: number | "auto";
}

/**
 * Brings back a player that stayed in memory while its node reconnected.
 *
 * @param player - The player.
 * @param context - What the node reported.
 * @returns What happened.
 */
export async function resumeLive(player: Player, context: LiveResumeContext): Promise<ResumeInfo> {
  const track = player.current;
  const gapMs = Math.max(0, Date.now() - context.since);
  const info = (mode: ResumeInfo["mode"], reason: string, gap = gapMs): ResumeInfo => ({
    mode,
    reason,
    gapMs: gap,
    confidence: "high",
  });
  if (!track) return info("seamless", "idle", 0);
  const fixed = track.isStream || !track.isSeekable;
  if (!context.resumed || !context.server || context.strategy === "snapshot") {
    const position = fixed
      ? 0
      : restartPosition(context.positionAtLoss, gapMs, context.rewindLeadMs);
    await player.resync(position);
    return info("rebuilt", context.resumed ? "snapshot-strategy" : "session-lost-resync");
  }
  const server = context.server;
  if (server.track?.encoded !== track.encoded) {
    return info("advanced", "track-ended-while-away");
  }
  const lost = context.voiceDropped || !server.state.connected;
  if (!lost) return info("seamless", "voice-stayed-up", 0);
  await player.connect();
  if (fixed) return info("rejoined", "stream-rejoin");
  if (context.strategy === "server") return info("rejoined", "voice-dropped");
  const listener = Math.min(server.state.position, context.positionAtLoss);
  const target = restartPosition(listener, gapMs, context.rewindLeadMs);
  const threshold = context.strategy === "listener" ? 0 : SEEK_THRESHOLD_MS;
  if (server.state.position - target > threshold) {
    await player.seek(target);
    return info("rejoined", "voice-dropped-seek-back");
  }
  return info("rejoined", "voice-dropped");
}
