import type { GatewayAdapter, GatewayPacket } from "../index.js";
import { toDispatch } from "./shared.js";

/**
 * The parts of a Seyfert `Client` or `WorkerClient` the adapter uses.
 */
export interface SeyfertClientLike {
  /** The bot's user id; empty before it's known. */
  botId: string;
  /** Present on `Client`: the shard manager. */
  gateway?: {
    calculateShardId(guildId: string): number;
    send(shardId: number, payload: unknown): unknown;
  };
  /** Present on `WorkerClient`: this worker's shards. */
  shards?: { get(id: number): { send(force: boolean, payload: unknown): unknown } | undefined };
  /**
   * Present on `WorkerClient`: works out a guild's shard.
   *
   * @param guildId - Guild id.
   */
  calculateShardId?(guildId: string): number;
}

/**
 * A Seyfert adapter. Seyfert has no raw listener on the client, so packets come in through a
 * `raw` event file that calls `handle()`; {@link seyfertRawEvent} builds it.
 */
export interface SeyfertAdapter extends GatewayAdapter {
  /**
   * Hands one raw packet to Lunalink.
   *
   * @param packet - The packet from Seyfert's `raw` event.
   */
  handle(packet: unknown): void;
}

/**
 * Connects Lunalink to a Seyfert `Client` or `WorkerClient`.
 *
 * @example
 * ```ts
 * // src/lunalink.ts
 * export const adapter = seyfert(client);
 * export const lunalink = new Lunalink({ adapter, nodes });
 *
 * // src/events/raw.ts
 * import { createEvent } from "seyfert";
 * export default createEvent(seyfertRawEvent(adapter));
 * ```
 * @param client - The Seyfert client.
 * @returns The adapter.
 */
export function seyfert(client: SeyfertClientLike): SeyfertAdapter {
  let handler: ((packet: GatewayPacket) => void) | null = null;
  return {
    clientId: () => client.botId || undefined,
    send: async (guildId, payload) => {
      if (client.gateway) {
        await client.gateway.send(client.gateway.calculateShardId(guildId), payload);
        return;
      }
      const shardId = client.calculateShardId?.(guildId);
      if (shardId !== undefined) await client.shards?.get(shardId)?.send(true, payload);
    },
    listen: (next) => {
      handler = next;
      return () => {
        if (handler === next) handler = null;
      };
    },
    handle: (packet) => {
      const dispatch = toDispatch(packet);
      if (dispatch) handler?.(dispatch);
    },
  };
}

/**
 * Builds the `raw` event for Seyfert's events folder. Pass the result to `createEvent()`.
 *
 * @param adapter - The adapter from {@link seyfert}.
 * @returns The event definition.
 */
export function seyfertRawEvent(adapter: SeyfertAdapter): {
  data: { name: "raw" };
  run: (packet: unknown) => void;
} {
  return {
    data: { name: "raw" },
    run: (packet) => {
      adapter.handle(packet);
    },
  };
}
