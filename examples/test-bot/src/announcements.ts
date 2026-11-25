import type { Player } from "lunalink";
import { client, lunalink } from "./lunalink.js";

function say(player: Player, text: string): void {
  if (!player.textChannelId) return;
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel?.isSendable()) void channel.send(text).catch(() => undefined);
}

export function announce(): void {
  lunalink.on("trackStart", (player, track) => {
    say(
      player,
      `Now playing **${track.title}** by ${track.author}${track.requester ? ` (asked by ${track.requester.tag})` : ""}`,
    );
  });
  lunalink.on("trackError", (player, track, error) => {
    say(player, `Couldn't play **${track.title}**: ${error.message}`);
  });
  lunalink.on("trackStuck", (player, track) => {
    say(player, `**${track.title}** got stuck, skipping it.`);
  });
  lunalink.on("queueEnd", (player) => {
    say(player, "The queue ended. Add more with /play or turn on /autoplay.");
  });
  lunalink.on("playerResumed", (player, info) => {
    say(player, `Resumed (${info.mode}, ${info.reason}, gap ${Math.round(info.gapMs / 1000)} s).`);
  });
  lunalink.on("playerNodeChange", (player, from, to) => {
    say(player, `Moved from node ${from} to ${to}.`);
  });
  lunalink.on("playerDestroy", (player, reason) => {
    if (reason === "autoLeave")
      say(player, "Left because nothing was playing or nobody was listening.");
  });
  lunalink.on("segmentSkipped", (player, segment) => {
    say(player, `Skipped a ${segment.category} segment.`);
  });
  lunalink.on("lyricsLine", (player, line) => {
    if (line.text) say(player, `> ${line.text}`);
  });
  lunalink.on("nodeReady", (node, resumed) => {
    console.log(`Node ${node.id} (${node.kind}) ready${resumed ? ", session resumed" : ""}`);
  });
  lunalink.on("nodeDisconnect", (node, code, reason) => {
    console.log(`Node ${node.id} disconnected: ${code} ${reason}`);
  });
  lunalink.on("pluginError", (plugin, label, error) => {
    console.error(`Plugin ${plugin} failed in ${label}:`, error);
  });
  lunalink.on("radio:started", (guildId) => {
    console.log(`radio plugin saw a track start in ${String(guildId)}`);
  });
  lunalink.on("debug", (event) => {
    if (event.level === "warn" || event.level === "error")
      console.warn(`[${event.scope}] ${event.message}`);
  });
}
