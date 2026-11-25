import { isRecord } from "../utils/guards.js";
import type { VoiceServerData, VoiceStateData } from "../voice/gatewayTypes.js";
import type { GatewayPacket } from "./GatewayAdapter.js";

/**
 * Where each gateway packet goes.
 */
export interface RawPacketHandlers {
  /**
   * Handles `VOICE_STATE_UPDATE`.
   *
   * @param data - Packet data.
   */
  voiceState(data: VoiceStateData): void;
  /**
   * Handles `VOICE_SERVER_UPDATE`.
   *
   * @param data - Packet data.
   */
  voiceServer(data: VoiceServerData): void;
  /**
   * Handles `GUILD_CREATE`.
   *
   * @param data - Packet data.
   */
  guildCreate(data: unknown): void;
  /**
   * Handles `GUILD_DELETE`.
   *
   * @param guildId - Guild id.
   */
  guildDelete(guildId: string): void;
  /**
   * Handles `READY`.
   *
   * @param userId - The bot's user id.
   */
  ready(userId: string): void;
}

/**
 * Sends one gateway packet to the right handler, after checking its shape. Packets Lunalink
 * doesn't need are ignored.
 *
 * @param packet - The packet.
 * @param handlers - Handlers.
 */
export function routeRawPacket(packet: GatewayPacket, handlers: RawPacketHandlers): void {
  const data = packet.d;
  if (!isRecord(data)) return;
  switch (packet.t) {
    case "VOICE_STATE_UPDATE":
      if (typeof data["user_id"] === "string" && typeof data["session_id"] === "string") {
        handlers.voiceState(data as unknown as VoiceStateData);
      }
      return;
    case "VOICE_SERVER_UPDATE":
      if (typeof data["guild_id"] === "string" && typeof data["token"] === "string") {
        handlers.voiceServer(data as unknown as VoiceServerData);
      }
      return;
    case "GUILD_CREATE":
      handlers.guildCreate(data);
      return;
    case "GUILD_DELETE":
      if (typeof data["id"] === "string" && data["unavailable"] !== true) {
        handlers.guildDelete(data["id"]);
      }
      return;
    case "READY": {
      const user = data["user"];
      if (isRecord(user) && typeof user["id"] === "string") handlers.ready(user["id"]);
      return;
    }
    default:
      return;
  }
}
