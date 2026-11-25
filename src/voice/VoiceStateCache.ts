import { isRecord } from "../utils/guards.js";
import type { VoiceStateData } from "./gatewayTypes.js";

interface Member {
  channelId: string;
  bot: boolean;
}

/**
 * Remembers who sits in which voice channel, from `GUILD_CREATE` and `VOICE_STATE_UPDATE`
 * packets. Auto-leave uses it to notice an empty channel. Only voice states are kept, so it
 * stays small even for large bots.
 */
export class VoiceStateCache {
  readonly #guilds = new Map<string, Map<string, Member>>();
  readonly #bots = new Set<string>();

  /**
   * Reads the voice states and members of a `GUILD_CREATE` packet.
   *
   * @param data - The packet's `d`.
   */
  handleGuildCreate(data: unknown): void {
    if (!isRecord(data) || typeof data["id"] !== "string") return;
    const guildId = data["id"];
    const members = Array.isArray(data["members"]) ? (data["members"] as unknown[]) : [];
    for (const member of members) {
      const user = isRecord(member) ? member["user"] : undefined;
      if (isRecord(user) && typeof user["id"] === "string" && user["bot"] === true) {
        this.#bots.add(user["id"]);
      }
    }
    const guild = new Map<string, Member>();
    const states = Array.isArray(data["voice_states"]) ? (data["voice_states"] as unknown[]) : [];
    for (const state of states) {
      if (!isRecord(state)) continue;
      const userId = state["user_id"];
      const channelId = state["channel_id"];
      if (typeof userId === "string" && typeof channelId === "string") {
        guild.set(userId, { channelId, bot: this.#bots.has(userId) });
      }
    }
    this.#guilds.set(guildId, guild);
  }

  /**
   * Applies a `VOICE_STATE_UPDATE`.
   *
   * @param data - The packet's `d`.
   */
  handleVoiceState(data: VoiceStateData): void {
    if (!data.guild_id) return;
    if (data.member?.user?.bot === true) this.#bots.add(data.user_id);
    let guild = this.#guilds.get(data.guild_id);
    if (!guild) {
      guild = new Map();
      this.#guilds.set(data.guild_id, guild);
    }
    if (data.channel_id === null) guild.delete(data.user_id);
    else guild.set(data.user_id, { channelId: data.channel_id, bot: this.#bots.has(data.user_id) });
  }

  /**
   * Counts the people in a channel, leaving out one user (the bot) and every known bot.
   *
   * @param guildId - Guild id.
   * @param channelId - Channel id.
   * @param exceptUserId - User to leave out, usually the bot itself.
   * @returns Number of listeners.
   */
  listeners(guildId: string, channelId: string, exceptUserId: string): number {
    let count = 0;
    for (const [userId, member] of this.#guilds.get(guildId) ?? []) {
      if (member.channelId === channelId && userId !== exceptUserId && !member.bot) count++;
    }
    return count;
  }

  /**
   * Lists the user ids in a channel.
   *
   * @param guildId - Guild id.
   * @param channelId - Channel id.
   * @returns User ids.
   */
  members(guildId: string, channelId: string): string[] {
    return [...(this.#guilds.get(guildId) ?? [])]
      .filter(([, member]) => member.channelId === channelId)
      .map(([userId]) => userId);
  }

  /**
   * Forgets a guild, for example when the bot leaves it.
   *
   * @param guildId - Guild id.
   */
  forgetGuild(guildId: string): void {
    this.#guilds.delete(guildId);
  }
}
