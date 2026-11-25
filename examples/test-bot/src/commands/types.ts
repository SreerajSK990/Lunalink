import type {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { Player } from "lunalink";
import { lunalink } from "../lunalink.js";

export interface Command {
  data: SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  run(interaction: ChatInputCommandInteraction<"cached">): Promise<unknown>;
}

export class UserError extends Error {}

export function voiceChannelOf(interaction: ChatInputCommandInteraction<"cached">): string {
  const member = interaction.member as GuildMember;
  const channelId = member.voice.channelId;
  if (!channelId) throw new UserError("Join a voice channel first.");
  return channelId;
}

export function requirePlayer(interaction: ChatInputCommandInteraction<"cached">): Player {
  const player = lunalink.players.get(interaction.guildId);
  if (!player) throw new UserError("Nothing is playing here. Use /play first.");
  return player;
}

export async function ensurePlayer(
  interaction: ChatInputCommandInteraction<"cached">,
): Promise<Player> {
  const voiceChannelId = voiceChannelOf(interaction);
  const player = lunalink.players.create({
    guildId: interaction.guildId,
    voiceChannelId,
    textChannelId: interaction.channelId,
  });
  if (!player.voice.connected || player.voiceChannelId !== voiceChannelId)
    await player.connect(voiceChannelId);
  return player;
}

export function requesterOf(interaction: ChatInputCommandInteraction<"cached">): {
  id: string;
  tag: string;
} {
  return { id: interaction.user.id, tag: interaction.user.tag };
}
