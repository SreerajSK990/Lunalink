import { definePlugin } from "lunalink/plugin";

const stations: Record<string, string> = {
  lofi: "https://streams.ilovemusic.de/iloveradio17.mp3",
  jazz: "https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3",
};

export const radioPlugin = () =>
  definePlugin({
    name: "radio",
    version: "1.0.0",
    apiVersion: 1,
    setup(ctx) {
      ctx.resolvers.register({
        name: "stations",
        match: (query) => query.startsWith("radio:"),
        resolve: (query) => {
          const url = stations[query.slice("radio:".length)];
          return url
            ? { type: "track", items: [{ identifier: url }] }
            : { type: "empty", items: [] };
        },
      });
      ctx.hooks.add("afterTrackEnd", (player, track, reason) => {
        ctx.logger.info(`${track.title} ended in ${player.guildId}: ${reason}`);
        return undefined;
      });
      ctx.events.on("trackStart", (player) => {
        ctx.events.emit("radio:started", player.guildId);
      });
      return undefined;
    },
  });
