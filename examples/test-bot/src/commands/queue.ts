import { SlashCommandBuilder } from "discord.js";
import { formatDuration } from "lunalink";
import { requirePlayer, UserError, type Command } from "./types.js";

const PAGE = 10;

const queue: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the queue")
    .addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)),
  async run(interaction) {
    const player = requirePlayer(interaction);
    const tracks = player.queue.tracks;
    const page = (interaction.options.getInteger("page") ?? 1) - 1;
    const lines = tracks
      .slice(page * PAGE, page * PAGE + PAGE)
      .map(
        (item, index) => `${page * PAGE + index + 1}. ${item.title} by ${item.author ?? "unknown"}`,
      );
    const current = player.current ? `Now: **${player.current.title}**\n` : "";
    const footer = `${tracks.length} upcoming · ${formatDuration(player.queue.duration)} total · history ${player.queue.history().length}`;
    return interaction.reply(`${current}${lines.join("\n") || "The queue is empty."}\n${footer}`);
  },
};

const position =
  (name: string, description: string) => (o: import("discord.js").SlashCommandIntegerOption) =>
    o.setName(name).setDescription(description).setMinValue(1).setRequired(true);

const remove: Command = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a track from the queue")
    .addIntegerOption(position("position", "Position in /queue")),
  async run(interaction) {
    const entry = requirePlayer(interaction).queue.remove(
      interaction.options.getInteger("position", true) - 1,
    );
    if (!entry) throw new UserError("There's no track at that position.");
    return interaction.reply(`Removed **${entry.item.title}**.`);
  },
};

const move: Command = {
  data: new SlashCommandBuilder()
    .setName("move")
    .setDescription("Move a track in the queue")
    .addIntegerOption(position("from", "Current position"))
    .addIntegerOption(position("to", "New position")),
  async run(interaction) {
    const from = interaction.options.getInteger("from", true) - 1;
    const to = interaction.options.getInteger("to", true) - 1;
    requirePlayer(interaction).queue.move(from, to);
    return interaction.reply(`Moved track ${from + 1} to ${to + 1}.`);
  },
};

const skipTo: Command = {
  data: new SlashCommandBuilder()
    .setName("skipto")
    .setDescription("Skip to a track in the queue")
    .addIntegerOption(position("position", "Position in /queue")),
  async run(interaction) {
    const target = interaction.options.getInteger("position", true);
    await requirePlayer(interaction).skip(target);
    return interaction.reply(`Skipped to track ${target}.`);
  },
};

const shuffle: Command = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue"),
  async run(interaction) {
    requirePlayer(interaction).queue.shuffle();
    return interaction.reply("Shuffled.");
  },
};

const clear: Command = {
  data: new SlashCommandBuilder().setName("clear").setDescription("Clear the upcoming tracks"),
  async run(interaction) {
    requirePlayer(interaction).queue.clear();
    return interaction.reply("Cleared the queue.");
  },
};

const dedupe: Command = {
  data: new SlashCommandBuilder().setName("dedupe").setDescription("Remove duplicate tracks"),
  async run(interaction) {
    const removed = requirePlayer(interaction).queue.removeDuplicates();
    return interaction.reply(`Removed ${removed.length} duplicate(s).`);
  },
};

export const queueCommands: Command[] = [queue, remove, move, skipTo, shuffle, clear, dedupe];
