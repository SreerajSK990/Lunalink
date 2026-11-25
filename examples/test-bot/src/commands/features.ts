import { SlashCommandBuilder } from "discord.js";
import { defaultTrackFactory, formatDuration, richSearch, UnsupportedFeatureError } from "lunalink";
import { lunalink } from "../lunalink.js";
import { ensurePlayer, requirePlayer, requesterOf, UserError, type Command } from "./types.js";

function unsupported(error: unknown): never {
  if (error instanceof UnsupportedFeatureError) throw new UserError(error.message);
  throw error;
}

const lyrics: Command = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Lyrics of the current track")
    .addBooleanOption((o) => o.setName("live").setDescription("Post each line as it plays")),
  async run(interaction) {
    const player = requirePlayer(interaction);
    if (interaction.options.getBoolean("live") !== null) {
      const live = interaction.options.getBoolean("live", true);
      await (live ? player.lyrics.subscribe() : player.lyrics.unsubscribe()).catch(unsupported);
      return interaction.reply(`Live lyrics ${live ? "on" : "off"}.`);
    }
    await interaction.deferReply();
    const found = await player.lyrics.current().catch(unsupported);
    if (!found) return interaction.editReply("No lyrics found.");
    const text = found.text.length > 1800 ? `${found.text.slice(0, 1800)}…` : found.text;
    return interaction.editReply(
      `${text}\n-# ${found.backend}${found.provider ? ` · ${found.provider}` : ""}`,
    );
  },
};

const sponsorBlock: Command = {
  data: new SlashCommandBuilder()
    .setName("sponsorblock")
    .setDescription("Skip sponsor segments on YouTube")
    .addStringOption((o) =>
      o
        .setName("categories")
        .setDescription("Comma separated, for example sponsor,intro. Empty turns it off"),
    ),
  async run(interaction) {
    const player = requirePlayer(interaction);
    const input = interaction.options.getString("categories");
    if (!input) {
      await player.sponsorBlock.clear().catch(unsupported);
      return interaction.reply("SponsorBlock off.");
    }
    const categories = input
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    await player.sponsorBlock.setCategories(categories).catch(unsupported);
    return interaction.reply(`Skipping: ${categories.join(", ")}.`);
  },
};

const chapters: Command = {
  data: new SlashCommandBuilder()
    .setName("chapters")
    .setDescription("Chapters of the current track"),
  async run(interaction) {
    const list = await requirePlayer(interaction).chapters.get().catch(unsupported);
    if (list.length === 0) return interaction.reply("This track has no chapters.");
    return interaction.reply(
      list.map((chapter) => `${formatDuration(chapter.start)} ${chapter.name}`).join("\n"),
    );
  },
};

const richSearchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("richsearch")
    .setDescription("Search tracks, albums, artists and playlists (LavaSearch)")
    .addStringOption((o) => o.setName("query").setDescription("Search text").setRequired(true)),
  async run(interaction) {
    await interaction.deferReply();
    const node = lunalink.nodes.select({
      guildId: interaction.guildId,
      region: null,
      exclude: new Set(),
    });
    const result = await richSearch(
      node,
      `spsearch:${interaction.options.getString("query", true)}`,
      ["track", "album", "artist", "playlist"],
      requesterOf(interaction),
      defaultTrackFactory,
    ).catch(unsupported);
    if (!result) return interaction.editReply("Nothing found.");
    return interaction.editReply(
      [
        `Tracks: ${
          result.tracks
            .slice(0, 3)
            .map((track) => track.title)
            .join(", ") || "none"
        }`,
        `Albums: ${
          result.albums
            .slice(0, 3)
            .map((album) => album.name)
            .join(", ") || "none"
        }`,
        `Artists: ${
          result.artists
            .slice(0, 3)
            .map((artist) => artist.name)
            .join(", ") || "none"
        }`,
        `Playlists: ${
          result.playlists
            .slice(0, 3)
            .map((playlist) => playlist.name)
            .join(", ") || "none"
        }`,
      ].join("\n"),
    );
  },
};

const nodelink: Command = {
  data: new SlashCommandBuilder()
    .setName("nodelink")
    .setDescription("NodeLink-only features")
    .addSubcommand((s) =>
      s
        .setName("crossfade")
        .setDescription("Blend tracks into each other")
        .addIntegerOption((o) =>
          o
            .setName("ms")
            .setDescription("Overlap in ms, 0 turns it off")
            .setMinValue(0)
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("normalizer")
        .setDescription("Even out loudness between tracks")
        .addBooleanOption((o) =>
          o.setName("enabled").setDescription("On or off").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("ducking")
        .setDescription("Lower music while someone talks")
        .addBooleanOption((o) =>
          o.setName("enabled").setDescription("On or off").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("mix")
        .setDescription("Layer another track over the current one")
        .addStringOption((o) =>
          o.setName("query").setDescription("What to layer").setRequired(true),
        ),
    ),
  async run(interaction) {
    const player = await ensurePlayer(interaction);
    const features = player.nodelink;
    switch (interaction.options.getSubcommand()) {
      case "crossfade": {
        const ms = interaction.options.getInteger("ms", true);
        await features
          .setCrossfade(ms === 0 ? { enabled: false } : { enabled: true, duration: ms })
          .catch(unsupported);
        return interaction.reply(ms === 0 ? "Crossfade off." : `Crossfade ${ms} ms.`);
      }
      case "normalizer": {
        const enabled = interaction.options.getBoolean("enabled", true);
        await features.setLoudnessNormalizer(enabled).catch(unsupported);
        return interaction.reply(`Loudness normalizer ${enabled ? "on" : "off"}.`);
      }
      case "ducking": {
        const enabled = interaction.options.getBoolean("enabled", true);
        await features.setDucking(enabled).catch(unsupported);
        return interaction.reply(`Ducking ${enabled ? "on" : "off"}.`);
      }
      default: {
        const result = await lunalink.search(interaction.options.getString("query", true));
        const track = result.tracks[0];
        if (track?.kind !== "track") throw new UserError("Nothing playable found.");
        const layer = await features.mixer.add(track, 0.5).catch(unsupported);
        return interaction.reply(`Layered **${track.title}** (mix ${layer.id}).`);
      }
    }
  },
};

export const featureCommands: Command[] = [
  lyrics,
  sponsorBlock,
  chapters,
  richSearchCommand,
  nodelink,
];
