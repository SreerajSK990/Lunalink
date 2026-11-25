# Getting started

## What you need

- Node.js 22 or later.
- A Discord bot with the `Guilds` and `GuildVoiceStates` intents.
- At least one Lavalink v4 or NodeLink server. Lunalink works with either, and with both at the same time.

## 1. Create the client

```ts
import { Lunalink } from "lunalink";
import { discordjs } from "lunalink/adapters/discordjs";

const lunalink = new Lunalink({
  adapter: discordjs(client),
  nodes: [
    { id: "lavalink", host: "localhost", port: 2333, password: "youshallnotpass" },
    { id: "nodelink", host: "localhost", port: 3000, password: "youshallnotpass" },
  ],
});
```

Only `adapter` and `nodes` are required. Create the client before you log in, so it sees the `GUILD_CREATE` packets it uses to track who is in which voice channel.

## 2. Connect once the bot is ready

```ts
client.once("ready", () => void lunalink.connect());
```

`connect()` installs plugins, connects every node and restores players saved before a restart. Nodes are created here, so `lunalink.nodes` is empty until you call it.

## 3. Play something

```ts
const player = lunalink.players.create({
  guildId: interaction.guildId,
  voiceChannelId: member.voice.channelId,
  textChannelId: interaction.channelId,
});
await player.connect();

const result = await lunalink.search("never gonna give you up", { requester: interaction.user });
if (result.type === "playlist") player.queue.add(result.tracks);
else if (result.tracks[0]) player.queue.add(result.tracks[0]);

if (!player.current) await player.play();
```

`players.create()` returns the existing player when the guild already has one. `player.play()` without arguments starts the queue. `player.play(track)` plays that track right away.

## 4. React to events

```ts
lunalink.on("trackStart", (player, track) => channel.send(`Now playing ${track.title}`));
lunalink.on("queueEnd", (player) => channel.send("The queue is empty."));
lunalink.on("trackError", (player, track, error) => console.warn(error.message));
```

The full list is in [events-and-errors.md](events-and-errors.md).

## 5. Type your requester

`track.requester` is `unknown` by default. Tell TypeScript what you pass:

```ts
declare module "lunalink" {
  interface Register {
    requester: { id: string; tag: string };
  }
}
```

## 6. Shut down cleanly

```ts
process.once("SIGTERM", () => void lunalink.shutdown({ mode: "pause" }));
```

`mode: "pause"` pauses every player and saves it, so the next start resumes where listeners stopped. That needs a store that outlives the process, such as `JsonFileStore` (see [lifecycle.md](lifecycle.md)); the default memory store is gone after a restart. The default `mode: "destroy"` leaves voice and forgets every player.
