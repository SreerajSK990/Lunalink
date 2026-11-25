import type { NodeStats } from "../../drivers/types.js";

/**
 * Scores how busy a node is. Lower is better. This formula is Lunalink's own choice; neither
 * Lavalink nor NodeLink defines one.
 *
 * `playingPlayers + serverLoad × 100 + frameDeficitRatio × 50`
 *
 * A node with no stats yet scores 0, so a freshly connected node gets work right away.
 *
 * @param stats - Node stats, or `null` when none arrived yet.
 * @returns The penalty.
 */
export function nodePenalty(stats: NodeStats | null): number {
  if (!stats) return 0;
  const frames = stats.frameStats;
  const expected = frames ? frames.sent + frames.deficit : 0;
  const deficitRatio = frames && expected > 0 ? Math.max(0, frames.deficit) / expected : 0;
  return stats.playingPlayers + stats.cpu.serverLoad * 100 + deficitRatio * 50;
}
