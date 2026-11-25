import type { GatewayAdapter } from "../index.js";
import { toDispatch } from "./shared.js";

type Handler = (...args: unknown[]) => void;

/**
 * The parts of an Eris `Client` the adapter uses.
 */
export interface ErisClientLike {
  /** The logged-in user. */
  user?: { id: string } | null;
  /** Guild cache. */
  guilds: {
    get(id: string): { shard: { sendWS(op: number, data: unknown): unknown } } | undefined;
  };
  /**
   * Adds a client event listener.
   *
   * @param event - Event name.
   * @param listener - Listener.
   */
  on(event: string, listener: Handler): unknown;
  /**
   * Removes a client event listener.
   *
   * @param event - Event name.
   * @param listener - Listener.
   */
  off(event: string, listener: Handler): unknown;
}

/**
 * Connects Lunalink to an Eris client. Packets come from the `rawWS` event; op 4 goes out
 * through `guild.shard.sendWS()`.
 *
 * @example
 * ```ts
 * import { eris } from "lunalink/adapters/eris";
 * const lunalink = new Lunalink({ adapter: eris(client), nodes });
 * ```
 * @param client - The Eris client.
 * @returns The adapter.
 */
export function eris(client: ErisClientLike): GatewayAdapter {
  return {
    clientId: () => client.user?.id,
    send: (guildId, payload) => {
      client.guilds.get(guildId)?.shard.sendWS(payload.op, payload.d);
    },
    listen: (handler) => {
      const listener: Handler = (packet) => {
        const dispatch = toDispatch(packet);
        if (dispatch) handler(dispatch);
      };
      client.on("rawWS", listener);
      return () => {
        client.off("rawWS", listener);
      };
    },
  };
}
