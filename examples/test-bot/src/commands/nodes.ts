import { SlashCommandBuilder } from "discord.js";
import { lunalink } from "../lunalink.js";
import { requirePlayer, UserError, type Command } from "./types.js";

const nodes: Command = {
  data: new SlashCommandBuilder().setName("nodes").setDescription("Show every node"),
  async run(interaction) {
    const lines = lunalink.nodes.list().map((node) => {
      const stats = node.stats;
      const load = stats
        ? ` · ${stats.playingPlayers}/${stats.players} playing · cpu ${(stats.cpu.serverLoad * 100).toFixed(1)}%`
        : "";
      return `**${node.id}** ${node.kind} ${node.info?.version.semver ?? "?"} · ${node.state}${load} · ${lunalink.players.on(node).length} here`;
    });
    return interaction.reply(lines.join("\n") || "No nodes.");
  },
};

const moveNode: Command = {
  data: new SlashCommandBuilder()
    .setName("movenode")
    .setDescription("Move this guild's player to another node")
    .addStringOption((o) =>
      o
        .setName("node")
        .setDescription("Node id")
        .setRequired(true)
        .addChoices(
          ...lunalink.options.nodes.map((node) => ({
            name: node.id ?? node.host,
            value: node.id ?? `${node.host}:${node.port}`,
          })),
        ),
    ),
  async run(interaction) {
    const target = lunalink.nodes.get(interaction.options.getString("node", true));
    if (!target?.connected) throw new UserError("That node isn't connected.");
    await requirePlayer(interaction).moveTo(target);
    return interaction.reply(`Moved to ${target.id}. Playback carried on from the same position.`);
  },
};

const restart: Command = {
  data: new SlashCommandBuilder()
    .setName("restart")
    .setDescription("Pause everything, save, and exit (resume test)"),
  async run(interaction) {
    await interaction.reply(
      "Saving players and exiting. Start the bot again; playback resumes where it stopped.",
    );
    await lunalink.shutdown({ mode: "pause" });
    process.exit(0);
  },
};

export const nodeCommands: Command[] = [nodes, moveNode, restart];
