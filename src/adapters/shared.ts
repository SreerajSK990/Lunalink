import type { GatewayPacket } from "../index.js";

/**
 * Works out which shard serves a guild, with Discord's formula `(guild_id >> 22) % shard_count`.
 *
 * @param guildId - Guild id.
 * @param shardCount - Total shards. Values below 1 count as 1.
 * @returns Shard id.
 */
export function shardIdFor(guildId: string, shardCount: number): number {
  const count = Math.max(1, Math.trunc(shardCount));
  return Number((BigInt(guildId) >> 22n) % BigInt(count));
}

/**
 * Picks the dispatch part out of a raw gateway packet.
 *
 * @param packet - Anything a library hands over as a raw packet.
 * @returns The packet, or `null` when it isn't a dispatch.
 */
export function toDispatch(packet: unknown): GatewayPacket | null {
  if (typeof packet !== "object" || packet === null) return null;
  const { t, d } = packet as { t?: unknown; d?: unknown };
  return typeof t === "string" ? { t, d } : null;
}
