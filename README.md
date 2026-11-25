# Lunalink

A TypeScript client for [Lavalink](https://github.com/lavalink-devs/Lavalink) v4 and [NodeLink](https://github.com/PerformanC/NodeLink), for Discord music bots.

- **No runtime dependencies.** It uses Node's built-in `fetch` and `WebSocket`. It ships ESM and CommonJS builds and needs Node 22 or later.
- **One API for both servers.** Lunalink detects whether each node is Lavalink or NodeLink and what it supports, and normalizes the differences. Features a node lacks throw `UnsupportedFeatureError` instead of failing silently.
- **Everything a music bot needs:** a queue with history, loop modes, autoplay, filters and presets, lyrics, SponsorBlock, chapters, LavaSearch, NodeLink's crossfade, mixer and loudness tools, auto-leave, failover between nodes, and auto-resume after a node reconnect or a bot restart.
- **Extendable.** Plugins can add client-side sources, hooks, autoplay strategies, presets and events, or replace the queue, store, player class, track factory, node selector and mirror matcher.

## Status

Version 0.1.0, not yet published to npm. The test suite runs against a mock Lavalink and NodeLink server; testing against real servers is in progress with the [manual checklist](docs/TESTING.md). Expect small API changes before 1.0.

## Requirements

- Node.js 22 or later
- Lavalink 4.x or NodeLink 3.x
- A Discord bot with the `Guilds` and `GuildVoiceStates` intents

## Install

```sh
npm install lunalink
```

## Quick start (discord.js)

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { Lunalink } from "lunalink";
import { discordjs } from "lunalink/adapters/discordjs";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const lunalink = new Lunalink({
  adapter: discordjs(client),
  nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
});

client.once("ready", () => void lunalink.connect());

lunalink.on("trackStart", (player, track) => {
  console.log(`Now playing ${track.title} in ${player.guildId}`);
});

async function play(guildId: string, voiceChannelId: string, query: string) {
  const player = lunalink.players.create({ guildId, voiceChannelId });
  await player.connect();
  const result = await lunalink.search(query);
  const first = result.tracks[0];
  if (first) await player.play(first);
}

await client.login(process.env.DISCORD_TOKEN);
```

Using Eris, Oceanic, Seyfert or your own gateway code? See [docs/adapters.md](docs/adapters.md).

## Entry points

| Import                                                             | What it has                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `lunalink`                                                         | The client and everything public                         |
| `lunalink/adapters/discordjs`, `eris`, `oceanic`, `seyfert`, `raw` | Discord library adapters                                 |
| `lunalink/stores/memory`, `lunalink/stores/json-file`              | Built-in stores for persistence                          |
| `lunalink/plugin`                                                  | What plugin authors need                                 |
| `lunalink/testing`                                                 | A mock node, a test harness and a conformance check      |
| `lunalink/protocol`                                                | Raw Lavalink and NodeLink wire types                     |
| `lunalink/transport/ws`                                            | Use the `ws` package instead of the built-in `WebSocket` |

## Documentation

1. [Getting started](docs/getting-started.md)
2. [Nodes](docs/nodes.md): Lavalink and NodeLink, capabilities, selection, failover
3. [Players and the queue](docs/players.md)
4. [Searching](docs/search.md): sources, links, unresolved tracks
5. [Filters](docs/filters.md)
6. [Server features](docs/features.md): lyrics, SponsorBlock, chapters, LavaSearch, NodeLink
7. [Lifecycle](docs/lifecycle.md): auto-leave, autoplay, persistence, auto-resume, shutdown
8. [Plugins](docs/plugins.md)
9. [Adapters](docs/adapters.md)
10. [Events, errors and debugging](docs/events-and-errors.md)
11. [Testing your bot and plugins](docs/testing-kit.md)
12. [Manual test checklist for the example bot](docs/TESTING.md)

The [example bot](examples/test-bot) has a slash command for every feature.

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; it covers setup, the rules every change follows, and how to test against real servers.

## License

[MIT](LICENSE)
