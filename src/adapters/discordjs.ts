import type { GatewayAdapter, VoiceStateUpdatePayload } from "../index.js";
import { shardIdFor, toDispatch } from "./shared.js";

type Handler = (...args: unknown[]) => void;

/**
 * The parts of a discord.js `Client` the adapter uses. Both discord.js v14 and the next major
 * fit: v14 emits `raw` on the client and sends through `guild.shard`, the next major emits
 * `dispatch` on `client.ws` and sends with `client.ws.send(shardId, payload)`.
 */
export interface DiscordJsClientLike {
  /** The logged-in user. */
  user: { id: string } | null;
  /** Guild cache. */
  guilds: {
    cache: {
      get(id: string): { shardId: number; shard?: { send(payload: unknown): unknown } } | undefined;
    };
  };
  /** The gateway manager. */
  ws: {
    shards?: unknown;
    send?(shardId: number, payload: unknown): unknown;
    on?(event: string, listener: Handler): unknown;
    off?(event: string, listener: Handler): unknown;
  };
  /** Client options. */
  options?: { shardCount?: number | "auto" | null };
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
 * Connects Lunalink to a discord.js client. Works with v14 and the next major; it checks which
 * one it has at runtime.
 *
 * @example
 * ```ts
 * import { Lunalink } from "lunalink";
 * import { discordjs } from "lunalink/adapters/discordjs";
 *
 * const lunalink = new Lunalink({ adapter: discordjs(client), nodes });
 * ```
 * @param client - The discord.js client. It needs the `Guilds` and `GuildVoiceStates` intents.
 * @returns The adapter.
 */
export function discordjs(client: DiscordJsClientLike): GatewayAdapter {
  const ws = client.ws;
  const usesDispatch = typeof ws.send === "function" && ws.shards === undefined;
  return {
    clientId: () => client.user?.id,
    send: (guildId: string, payload: VoiceStateUpdatePayload) => {
      const guild = client.guilds.cache.get(guildId);
      if (usesDispatch) {
        const count =
          typeof client.options?.shardCount === "number" ? client.options.shardCount : 1;
        void ws.send?.(guild?.shardId ?? shardIdFor(guildId, count), payload);
        return;
      }
      guild?.shard?.send(payload);
    },
    listen: (handler) => {
      const listener: Handler = (packet) => {
        const dispatch = toDispatch(packet);
        if (dispatch) handler(dispatch);
      };
      if (usesDispatch) {
        ws.on?.("dispatch", listener);
        return () => {
          ws.off?.("dispatch", listener);
        };
      }
      client.on("raw", listener);
      return () => {
        client.off("raw", listener);
      };
    },
  };
}
