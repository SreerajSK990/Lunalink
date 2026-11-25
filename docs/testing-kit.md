# Testing your bot and plugins

`lunalink/testing` runs without a real Discord or audio server. It has no dependencies; the mock server uses `node:http`.

## A connected client in one call

```ts
import { createHarness, track } from "lunalink/testing";

const { lunalink, node, discord, stop } = await createHarness({
  lunalink: { plugins: [myPlugin()], autoLeave: { emptyQueueMs: 50 } },
});

node.loadTracks = (identifier) => ({ loadType: "search", data: [track("a"), track("b")] });

const player = lunalink.players.create({
  guildId: "81384788765712384",
  voiceChannelId: "81384788862181376",
});
await player.connect();
await player.play((await lunalink.search("anything")).tracks[0]!);

node.sendTrackStart("81384788765712384", track("a"));
node.sendTrackEnd("81384788765712384", track("a"));

await stop();
```

- `createHarness({ node, discord, lunalink })` starts a `MockNode`, a fake Discord and a connected `Lunalink`.
- The fake Discord (`createTestDiscord()`) answers every voice join with the packets Discord sends, so `player.connect()` resolves. `discord.sent` holds every op 4 payload; `discord.moveUser(guildId, channelId, userId)` makes a listener join or leave, for auto-leave tests.
- `track(id, overrides)` builds a track with predictable values (`Song <id>` by `Artist <id>`).

## The mock node

`new MockNode({ kind: "lavalink" | "nodelink", password, plugins }).start()` serves the info, stats, load tracks, player and session routes and the WebSocket.

| Member                                                                    | Use                                        |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| `loadTracks = (identifier) => body`                                       | Answer `/v4/loadtracks`                    |
| `routes.push((request) => ({ status, body }))`                            | Answer any other route                     |
| `requests`, `requestsTo(method, pathPart)`                                | What Lunalink sent                         |
| `players`                                                                 | The server's players                       |
| `sendTrackStart`, `sendTrackEnd`, `sendEvent`, `sendPlayerUpdate`, `send` | Push messages                              |
| `dropConnections(code)`                                                   | Simulate a crash (`1006`) or a clean close |
| `resumable`, `sessionId`, `upgrades`                                      | Session and handshake state                |

## Checking a server

```ts
import { checkNodeConformance } from "lunalink/testing";

const report = await checkNodeConformance({
  node: { host: "localhost", port: 2333, password: "youshallnotpass" },
});
console.log(report.passed, report.checks);
```

It connects, reads info, waits for `ready`, reads stats, loads tracks, enables resuming, and creates, reads, lists and deletes one player. Run it against a new server version, a fork, or a server that imitates Lavalink.
