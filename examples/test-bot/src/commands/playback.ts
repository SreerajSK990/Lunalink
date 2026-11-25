import { SlashCommandBuilder } from "discord.js";
import {
  formatDuration,
  parseDuration,
  type LoopMode,
  type QueueItem,
  type SearchPlatformName,
} from "lunalink";
import { lunalink } from "../lunalink.js";
import { ensurePlayer, requirePlayer, requesterOf, UserError, type Command } from "./types.js";

const sources: SearchPlatformName[] = [
  "youtube",
  "youtubeMusic",
  "soundcloud",
  "spotify",
  "deezer",
  "appleMusic",
];

function describe(item: QueueItem): string {
  const length = item.kind === "track" ? item.duration : (item.durationMs ?? 0);
  return `**${item.title}** by ${item.author ?? "unknown"} (${item.kind === "track" && item.isStream ? "live" : formatDuration(length)})`;
}

const play: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song, a link or a playlist")
    .addStringOption((o) =>
      o.setName("query").setDescription("Text, a link, or radio:lofi").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("source")
        .setDescription("Where to search text")
        .addChoices(...sources.map((source) => ({ name: source, value: source }))),
    )
    .addBooleanOption((o) => o.setName("next").setDescription("Put it at the front of the queue")),
  async run(interaction) {
    await interaction.deferReply();
    const player = await ensurePlayer(interaction);
    const source = interaction.options.getString("source") as SearchPlatformName | null;
    const result = await lunalink.search(interaction.options.getString("query", true), {
      requester: requesterOf(interaction),
      ...(source ? { source } : {}),
    });
    if (result.type === "error")
      throw new UserError(`Loading failed: ${result.error?.message ?? "unknown error"}`);
    if (result.tracks.length === 0) throw new UserError("Nothing found.");
    const items = result.type === "playlist" ? result.tracks : result.tracks.slice(0, 1);
    const position = interaction.options.getBoolean("next") ? 0 : undefined;
    player.queue.add(items, position === undefined ? {} : { position });
    if (!player.current) await player.play();
    const first = items[0];
    return interaction.editReply(
      result.type === "playlist"
        ? `Queued ${items.length} tracks from **${result.playlist?.name ?? "a playlist"}**.`
        : `Queued ${first ? describe(first) : "a track"}.`,
    );
  },
};

const simple = (
  name: string,
  description: string,
  action: (player: ReturnType<typeof requirePlayer>) => Promise<string>,
): Command => ({
  data: new SlashCommandBuilder().setName(name).setDescription(description),
  async run(interaction) {
    return interaction.reply(await action(requirePlayer(interaction)));
  },
});

const pause = simple("pause", "Pause playback", async (player) => {
  await player.pause();
  return "Paused.";
});
const resume = simple("resume", "Resume playback", async (player) => {
  await player.resume();
  return "Resumed.";
});
const previous = simple("previous", "Play the previous track", async (player) =>
  (await player.previous()) ? "Went back." : "There is no previous track.",
);
const stop = simple("stop", "Stop and clear the queue", async (player) => {
  await player.stop(true);
  return "Stopped and cleared the queue.";
});
const nowPlaying = simple("nowplaying", "Show the current track", async (player) => {
  const track = player.current;
  if (!track) return "Nothing is playing.";
  const position = track.isStream
    ? "live"
    : `${formatDuration(player.position)} / ${formatDuration(track.duration)}`;
  return `${describe(track)}\n${position} · volume ${player.volume} · loop ${player.loop} · autoplay ${player.autoplay ? "on" : "off"} · node ${player.node.id}`;
});

const skip: Command = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track")
    .addIntegerOption((o) =>
      o.setName("count").setDescription("How many tracks to skip").setMinValue(1),
    ),
  async run(interaction) {
    await requirePlayer(interaction).skip(interaction.options.getInteger("count") ?? 1);
    return interaction.reply("Skipped.");
  },
};

const seek: Command = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Jump to a position")
    .addStringOption((o) => o.setName("time").setDescription("For example 1:30").setRequired(true)),
  async run(interaction) {
    const position = parseDuration(interaction.options.getString("time", true));
    if (position === null) throw new UserError("Use a time like 90, 1:30 or 1:02:03.");
    await requirePlayer(interaction).seek(position);
    return interaction.reply(`Jumped to ${formatDuration(position)}.`);
  },
};

const volume: Command = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Change the volume")
    .addIntegerOption((o) =>
      o
        .setName("level")
        .setDescription("0 to 1000")
        .setMinValue(0)
        .setMaxValue(1000)
        .setRequired(true),
    ),
  async run(interaction) {
    const level = interaction.options.getInteger("level", true);
    await requirePlayer(interaction).setVolume(level);
    return interaction.reply(`Volume set to ${level}.`);
  },
};

const loop: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Change the loop mode")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Loop mode")
        .setRequired(true)
        .addChoices(
          { name: "off", value: "off" },
          { name: "track", value: "track" },
          { name: "queue", value: "queue" },
        ),
    ),
  async run(interaction) {
    const mode = interaction.options.getString("mode", true) as LoopMode;
    requirePlayer(interaction).setLoop(mode);
    return interaction.reply(`Loop: ${mode}.`);
  },
};

const autoplay: Command = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Queue related tracks when the queue runs out")
    .addBooleanOption((o) => o.setName("enabled").setDescription("On or off").setRequired(true)),
  async run(interaction) {
    const enabled = interaction.options.getBoolean("enabled", true);
    requirePlayer(interaction).setAutoplay(enabled);
    return interaction.reply(`Autoplay ${enabled ? "on" : "off"}.`);
  },
};

const join: Command = {
  data: new SlashCommandBuilder().setName("join").setDescription("Join your voice channel"),
  async run(interaction) {
    const player = await ensurePlayer(interaction);
    return interaction.reply(`Joined <#${player.voiceChannelId ?? ""}> on node ${player.node.id}.`);
  },
};

const leave: Command = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave voice and forget the queue"),
  async run(interaction) {
    await requirePlayer(interaction).destroy();
    return interaction.reply("Left.");
  },
};

export const playbackCommands: Command[] = [
  join,
  leave,
  play,
  pause,
  resume,
  skip,
  previous,
  stop,
  seek,
  volume,
  loop,
  autoplay,
  nowPlaying,
];
