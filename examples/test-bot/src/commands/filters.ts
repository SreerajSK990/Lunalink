import { SlashCommandBuilder } from "discord.js";
import { builtInPresets } from "lunalink";
import { requirePlayer, type Command } from "./types.js";

const filter: Command = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Audio filters")
    .addSubcommand((s) =>
      s
        .setName("preset")
        .setDescription("Turn a preset on or off")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Preset")
            .setRequired(true)
            .addChoices(
              ...builtInPresets.map((preset) => ({ name: preset.name, value: preset.name })),
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("equalizer")
        .setDescription("Set one equalizer band")
        .addIntegerOption((o) =>
          o
            .setName("band")
            .setDescription("0 to 14")
            .setMinValue(0)
            .setMaxValue(14)
            .setRequired(true),
        )
        .addNumberOption((o) =>
          o
            .setName("gain")
            .setDescription("-0.25 to 1")
            .setMinValue(-0.25)
            .setMaxValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("speed")
        .setDescription("Change speed and pitch")
        .addNumberOption((o) =>
          o
            .setName("speed")
            .setDescription("0.5 to 2")
            .setMinValue(0.5)
            .setMaxValue(2)
            .setRequired(true),
        )
        .addNumberOption((o) =>
          o.setName("pitch").setDescription("0.5 to 2").setMinValue(0.5).setMaxValue(2),
        ),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Show active filters and every preset"))
    .addSubcommand((s) => s.setName("clear").setDescription("Turn every filter off")),
  async run(interaction) {
    const player = requirePlayer(interaction);
    switch (interaction.options.getSubcommand()) {
      case "preset": {
        const name = interaction.options.getString("name", true);
        const on = await player.filters.toggle(name);
        return interaction.reply(`${name} ${on ? "on" : "off"}.`);
      }
      case "equalizer": {
        const band = interaction.options.getInteger("band", true);
        const gain = interaction.options.getNumber("gain", true);
        await player.filters.setEqualizer([{ band, gain }]);
        return interaction.reply(`Band ${band} set to ${gain}.`);
      }
      case "speed": {
        const speed = interaction.options.getNumber("speed", true);
        const pitch = interaction.options.getNumber("pitch") ?? 1;
        await player.filters.set({ timescale: { speed, pitch, rate: 1 } });
        return interaction.reply(`Speed ${speed}, pitch ${pitch}.`);
      }
      case "list": {
        const presets = player.filters
          .presets()
          .map((preset) => `\`${preset.name}\` ${preset.description}`);
        return interaction.reply(
          `Active: ${player.filters.active().join(", ") || "none"}\n${presets.join("\n")}`,
        );
      }
      default:
        await player.filters.clear();
        return interaction.reply("Filters cleared.");
    }
  },
};

export const filterCommands: Command[] = [filter];
