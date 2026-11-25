import { Client, GatewayIntentBits } from "discord.js";
import { Lunalink } from "lunalink";
import { discordjs } from "lunalink/adapters/discordjs";
import { JsonFileStore } from "lunalink/stores/json-file";
import { env } from "./env.js";
import { radioPlugin } from "./radioPlugin.js";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

export const lunalink = new Lunalink({
  adapter: discordjs(client),
  nodes: env.nodes,
  store: new JsonFileStore({ path: env.storePath }),
  plugins: [radioPlugin()],
  autoLeave: { emptyQueueMs: 120_000, emptyChannelMs: 60_000 },
  player: { volume: 80 },
});
