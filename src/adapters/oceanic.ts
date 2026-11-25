import type { GatewayAdapter } from "../index.js";
import { toDispatch } from "./shared.js";

type Handler = (...args: unknown[]) => void;

/**
 * The parts of an Oceanic `Client` the adapter uses.
 */
export interface OceanicClientLike {
  /** Guild cache. */
  guilds: { get(id: string): { shard: { send(op: number, data: unknown): unknown } } | undefined };
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
 * Connects Lunalink to an Oceanic client. Packets come from the `packet` event; op 4 goes out
 * through `guild.shard.send()`. Oceanic's `client.user` throws before the first `READY`, so the
 * bot id is read from the `READY` packet instead.
 *
 * @example
 * ```ts
 * import { oceanic } from "lunalink/adapters/oceanic";
 * const lunalink = new Lunalink({ adapter: oceanic(client), nodes });
 * ```
 * @param client - The Oceanic client.
 * @returns The adapter.
 */
export function oceanic(client: OceanicClientLike): GatewayAdapter {
  let userId: string | undefined;
  return {
    clientId: () => userId,
    send: (guildId, payload) => {
      client.guilds.get(guildId)?.shard.send(payload.op, payload.d);
    },
    listen: (handler) => {
      const listener: Handler = (packet) => {
        const dispatch = toDispatch(packet);
        if (!dispatch) return;
        if (dispatch.t === "READY") userId = readyUserId(dispatch.d) ?? userId;
        handler(dispatch);
      };
      client.on("packet", listener);
      return () => {
        client.off("packet", listener);
      };
    },
  };
}

function readyUserId(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const user = (data as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : undefined;
}
