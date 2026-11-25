import type { GatewayAdapter, GatewayPacket, GatewaySender } from "../index.js";
import { toDispatch } from "./shared.js";

export { shardIdFor } from "./shared.js";

/**
 * What a raw-gateway bot provides.
 */
export interface RawAdapterOptions {
  /** Returns the bot's user id. */
  clientId(): string | undefined;
  /** Sends op 4 on the shard that serves the guild. */
  send: GatewaySender;
}

/**
 * An adapter you feed yourself. Call `handle()` with every gateway packet you receive.
 */
export interface RawAdapter extends GatewayAdapter {
  /**
   * Hands one gateway packet to Lunalink. Non-dispatch packets are ignored.
   *
   * @param packet - The packet, with `t` and `d`.
   */
  handle(packet: unknown): void;
}

/**
 * Builds an adapter for bots that talk to the gateway directly, or for libraries without a
 * shipped adapter.
 *
 * @example
 * ```ts
 * import { raw } from "lunalink/adapters/raw";
 * const adapter = raw({ clientId: () => botId, send: (guildId, payload) => shardFor(guildId).send(payload) });
 * gateway.on("packet", (packet) => adapter.handle(packet));
 * ```
 * @param options - User id and op 4 sender.
 * @returns The adapter.
 */
export function raw(options: RawAdapterOptions): RawAdapter {
  const handlers = new Set<(packet: GatewayPacket) => void>();
  return {
    clientId: () => options.clientId(),
    send: (guildId, payload) => options.send(guildId, payload),
    listen: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    handle: (packet) => {
      const dispatch = toDispatch(packet);
      if (!dispatch) return;
      for (const handler of handlers) handler(dispatch);
    },
  };
}
