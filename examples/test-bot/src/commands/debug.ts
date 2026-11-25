import { SlashCommandBuilder, type SendableChannels } from "discord.js";
import type { DebugLevel } from "lunalink";
import { checkNodeConformance } from "lunalink/testing";
import { lunalink } from "../lunalink.js";
import { requirePlayer, UserError, type Command } from "./types.js";

const levels: DebugLevel[] = ["trace", "info", "warn", "error"];
let stopLog: (() => void) | null = null;

function block(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  return `\`\`\`json\n${text.length > 1900 ? `${text.slice(0, 1900)}\n…` : text}\n\`\`\``;
}

const debug: Command = {
  data: new SlashCommandBuilder()
    .setName("debug")
    .setDescription("Look inside Lunalink")
    .addSubcommand((s) => s.setName("player").setDescription("This guild's player state"))
    .addSubcommand((s) =>
      s
        .setName("node")
        .setDescription("A node's info and capabilities")
        .addStringOption((o) => o.setName("id").setDescription("Node id").setRequired(true)),
    )
    .addSubcommand((s) => s.setName("plugins").setDescription("Installed plugins and their status"))
    .addSubcommand((s) =>
      s
        .setName("explain")
        .setDescription("Which resolver would handle a query")
        .addStringOption((o) => o.setName("query").setDescription("Query").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("log")
        .setDescription("Stream debug events to this channel")
        .addStringOption((o) =>
          o
            .setName("level")
            .setDescription("Lowest level to show, or off")
            .setRequired(true)
            .addChoices(...levels.map((level) => ({ name: level, value: level })), {
              name: "off",
              value: "off",
            }),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("conformance")
        .setDescription("Check that a node speaks Lavalink v4 as expected")
        .addStringOption((o) => o.setName("id").setDescription("Node id").setRequired(true)),
    ),
  async run(interaction) {
    switch (interaction.options.getSubcommand()) {
      case "player": {
        const player = requirePlayer(interaction);
        return interaction.reply(
          block({
            guildId: player.guildId,
            node: player.node.id,
            state: player.state,
            position: player.position,
            volume: player.volume,
            loop: player.loop,
            autoplay: player.autoplay,
            voice: { channelId: player.voiceChannelId, connected: player.voice.connected },
            current: player.current?.title ?? null,
            upcoming: player.queue.length,
            filters: player.filters.active(),
          }),
        );
      }
      case "node": {
        const node = lunalink.nodes.get(interaction.options.getString("id", true));
        if (!node) throw new UserError("No node with that id.");
        return interaction.reply(
          block({
            id: node.id,
            kind: node.kind,
            state: node.state,
            sessionId: node.sessionId,
            version: node.info?.version.semver,
            capabilities: node.capabilities.list(),
          }),
        );
      }
      case "plugins":
        return interaction.reply(
          block(
            lunalink.plugins.list().map(({ name, version, status, error }) => ({
              name,
              version,
              status,
              error: error ? String(error) : null,
            })),
          ),
        );
      case "explain":
        return interaction.reply(
          block(lunalink.plugins.explain(interaction.options.getString("query", true))),
        );
      case "log": {
        const level = interaction.options.getString("level", true);
        stopLog?.();
        stopLog = null;
        if (level === "off") return interaction.reply("Debug log off.");
        const min = levels.indexOf(level as DebugLevel);
        const channel = interaction.channel as SendableChannels | null;
        stopLog = lunalink.on("debug", (event) => {
          if (levels.indexOf(event.level) < min) return;
          void channel
            ?.send(`\`${event.level}\` \`${event.scope}\` ${event.message}`)
            .catch(() => undefined);
        });
        return interaction.reply(`Streaming debug events at ${level} and above.`);
      }
      default: {
        const id = interaction.options.getString("id", true);
        const options = lunalink.options.nodes.find(
          (node) => (node.id ?? `${node.host}:${node.port}`) === id,
        );
        if (!options) throw new UserError("No node with that id.");
        await interaction.deferReply();
        const report = await checkNodeConformance({ node: { ...options, id: `${id}-check` } });
        return interaction.editReply(
          report.checks
            .map(
              (check) =>
                `${check.ok ? "✅" : "❌"} ${check.name}${check.detail ? `: ${check.detail}` : ""}`,
            )
            .join("\n"),
        );
      }
    }
  },
};

export const debugCommands: Command[] = [debug];
