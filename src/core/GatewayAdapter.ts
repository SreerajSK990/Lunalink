import type { GatewaySender } from "../voice/gatewayTypes.js";

/**
 * A raw Discord gateway dispatch: the `t` and `d` fields of an op 0 packet.
 */
export interface GatewayPacket {
  /** Event name, for example `VOICE_STATE_UPDATE`. */
  t: string | null;
  /** Event data. */
  d: unknown;
}

/**
 * Connects Lunalink to your Discord library. Use a shipped adapter from `lunalink/adapters/*`,
 * or write one: it needs the bot's user id, a way to send op 4 on the right shard, and the raw
 * gateway packets.
 *
 * @example
 * ```ts
 * const adapter: GatewayAdapter = {
 *   clientId: () => client.user?.id,
 *   send: (guildId, payload) => client.shardFor(guildId).send(payload),
 *   listen: (handler) => client.onRawPacket(handler),
 * };
 * ```
 */
export interface GatewayAdapter {
  /**
   * Returns the bot's user id.
   *
   * @returns The id, or `undefined` before login.
   */
  clientId(): string | undefined;
  /** Sends an op 4 voice state update on the shard that serves the guild. */
  send: GatewaySender;
  /**
   * Starts handing raw gateway packets to Lunalink.
   *
   * @param handler - Called with every dispatch packet.
   * @returns A function that stops listening.
   */
  listen(handler: (packet: GatewayPacket) => void): () => void;
}
