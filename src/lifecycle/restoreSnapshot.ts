import type { Node } from "../node/Node.js";
import type { Player } from "../player/Player.js";
import type { PlayerManager } from "../player/PlayerManager.js";
import type { ApiPlayer } from "../protocol/index.js";
import type { Queue } from "../queue/types.js";
import type { TrackFactory } from "../track/toSearchResult.js";
import type { Track } from "../track/Track.js";
import {
  listenerPosition,
  type ResumeInfo,
  type ResumeStrategy,
  restartPosition,
  SEEK_THRESHOLD_MS,
} from "./resumeMath.js";
import { loadQueue, type PlayerSnapshot, type RequesterCodec } from "./snapshot.js";

/**
 * What {@link restoreSnapshot} needs.
 */
export interface RestoreContext {
  /** Node to rebuild on. */
  node: Node;
  /** Player manager. */
  players: PlayerManager;
  /** Builds tracks. */
  trackFactory: TrackFactory;
  /** Requester codec. */
  codec: RequesterCodec | undefined;
  /** The server's copy of the player when the session survived, otherwise `null`. */
  server: ApiPlayer | null;
  /** When the old process was last alive. */
  lastAliveAt: number | null;
  /** Heartbeat interval, to tell a stale snapshot. */
  heartbeatMs: number;
  /** Strategy. */
  strategy: ResumeStrategy;
  /** Rewind lead. */
  rewindLeadMs: number | "auto";
  /**
   * Checks for listeners.
   *
   * @param player - The player.
   * @returns `true` when someone listens.
   */
  hasListeners(player: Player): boolean;
}

/**
 * Rebuilds a player from a saved snapshot after a restart. The Discord voice connection never
 * survives a restart, so voice is always joined again.
 *
 * @param snapshot - The saved player.
 * @param context - Node, players and server state.
 * @returns The player and what happened, or `null` when there was nothing to restore.
 */
export async function restoreSnapshot(
  snapshot: PlayerSnapshot,
  context: RestoreContext,
): Promise<{ player: Player; info: ResumeInfo } | null> {
  if (!snapshot.voiceChannelId) return null;
  const player = context.players.create({
    guildId: snapshot.guildId,
    voiceChannelId: snapshot.voiceChannelId,
    textChannelId: snapshot.textChannelId,
    nodeId: context.node.id,
    volume: snapshot.volume,
    loop: snapshot.loop,
    autoplay: snapshot.autoplay,
  });
  const queue: Queue = player.queue;
  await queue.restore(loadQueue(snapshot, context.trackFactory, context.codec));
  player.filters.load(snapshot.filters);
  await player.connect();

  const lastAlive = context.lastAliveAt;
  const stale = lastAlive === null || lastAlive - snapshot.at > 2 * context.heartbeatMs;
  const gapMs = Math.max(0, Date.now() - (lastAlive ?? snapshot.at));
  const item = (await queue.current())?.item;
  const hold = !snapshot.paused && !context.hasListeners(player);
  const paused = snapshot.paused || hold;
  const done = (
    mode: ResumeInfo["mode"],
    reason: string,
  ): { player: Player; info: ResumeInfo } => ({
    player,
    info: {
      mode: hold ? "held" : mode,
      reason: hold ? "empty-channel-hold" : reason,
      gapMs,
      confidence: stale ? "low" : "high",
    },
  });
  if (!item) return done("rebuilt", "empty-queue");

  const server = context.strategy === "snapshot" ? null : context.server;
  const fixed = item.kind === "track" && (item.isStream || !item.isSeekable);
  const serverPosition =
    server?.track && item.kind === "track" && server.track.encoded === item.encoded
      ? server.state.position
      : null;
  const listener = stale
    ? (serverPosition ?? snapshot.position)
    : listenerPosition({
        position: snapshot.position,
        at: snapshot.at,
        lastAliveAt: lastAlive,
        serverPosition,
      });
  const target = snapshot.paused
    ? snapshot.position
    : restartPosition(listener, gapMs, context.rewindLeadMs);

  if (server && serverPosition !== null && item.kind === "track") {
    player.adopt(item, { position: serverPosition, paused: server.paused, volume: server.volume });
    if (paused !== server.paused) await player.setPaused(paused);
    if (fixed) return done("rejoined", "stream-rejoin");
    if (snapshot.paused) {
      if (Math.abs(serverPosition - target) > SEEK_THRESHOLD_MS) await player.seek(target);
      return done("rejoined", "paused-restore");
    }
    if (context.strategy === "server") return done("rejoined", "voice-dropped");
    const threshold = context.strategy === "listener" ? 0 : SEEK_THRESHOLD_MS;
    if (serverPosition - target > threshold) {
      await player.seek(target);
      return done("rejoined", "voice-dropped-seek-back");
    }
    return done("rejoined", "voice-dropped");
  }

  if (server) {
    const advanced = await advanceTo(queue, server.track?.encoded ?? null);
    if (advanced) {
      player.adopt(advanced, {
        position: server.state.position,
        paused: server.paused,
        volume: server.volume,
      });
      if (paused !== server.paused) await player.setPaused(paused);
      return done("advanced", "gapless-advance-while-away");
    }
    await queue.advance(snapshot.loop);
    await player.play(undefined, { paused });
    return done("advanced", "track-ended-while-away");
  }

  await player.play(undefined, fixed ? { paused } : { startTime: target, paused });
  if (Object.keys(snapshot.filters).length > 0) {
    await player.filters.replace(snapshot.filters).catch(() => undefined);
  }
  if (fixed) return done("rebuilt", "stream-rebuild");
  return done("rebuilt", snapshot.paused ? "paused-restore" : "session-lost-rebuild");
}

async function advanceTo(queue: Queue, encoded: string | null): Promise<Track | null> {
  if (encoded === null) return null;
  const next = (await queue.upcoming())[0]?.item;
  if (next?.kind !== "track" || next.encoded !== encoded) return null;
  await queue.advance("off");
  return next;
}
