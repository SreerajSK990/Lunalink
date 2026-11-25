# Nodes

A node is one Lavalink or NodeLink server. Pass them in `nodes`:

```ts
nodes: [
  { id: "eu-1", host: "eu.example.com", port: 443, password: "…", secure: true, regions: ["eu"] },
  { id: "us-1", host: "us.example.com", port: 2333, password: "…", regions: ["us"] },
],
```

| Option                     | Default                                | Meaning                                                                      |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                       | `host:port`                            | Unique name, used in logs and `lunalink.nodes.get(id)`                       |
| `host`, `port`, `password` | —                                      | Where the server is                                                          |
| `secure`                   | `false`                                | Use `https` and `wss`                                                        |
| `type`                     | `"auto"`                               | Force `"lavalink"` or `"nodelink"` instead of detecting it                   |
| `regions`                  | `[]`                                   | Discord voice regions this node serves, for example `["us", "eu"]`           |
| `priority`                 | `0`                                    | Used by the `priority` selection strategy                                    |
| `sessionId`                | —                                      | A session to resume on the first connect                                     |
| `requestTimeoutMs`         | `10000`                                | REST timeout                                                                 |
| `reconnect`                | 1 s base, 30 s max, unlimited attempts | `{ baseDelayMs, maxDelayMs, maxAttempts }` with jittered backoff             |
| `silenceTimeoutMs`         | `150000`                               | Reconnect when nothing arrives on the socket for this long. `0` turns it off |
| `assumeCapabilities`       | `[]`                                   | Capabilities to add when the server doesn't report them                      |
| `headers`                  | `{}`                                   | Extra headers on every request                                               |

## Lavalink or NodeLink

With `type: "auto"`, Lunalink reads `/v4/info` before opening the socket and checks the response for NodeLink's markers. Everything that differs between the two servers (stats fields, event names, lyrics and SponsorBlock routes, filter names) goes through a driver, so the rest of the library never checks which server it talks to.

## Capabilities

Each node gets a capability set from its info: its source managers, filters, server plugins and version. Check one before using a feature:

```ts
if (player.supports("filter:echo")) await player.filters.set({ echo: { delay: 0.3, decay: 0.4 } });
if (node.supports("lyrics")) console.log("This node can fetch lyrics.");
console.log(node.capabilities.list());
```

Names you'll see: `source:<name>`, `filter:<name>`, `plugin:<name>`, `lyrics`, `lyrics:live`, `sponsorblock`, `chapters`, `search:lavasearch`, `voice:dave` (Lavalink 4.2+), and `nodelink:*` for NodeLink-only features (`nodelink:mixer`, `nodelink:crossfade`, `nodelink:loudness`, `nodelink:voiceReceive` and others).

A feature the node lacks throws `UnsupportedFeatureError` with the capability name, so you can show the user a clear message.

## Choosing a node

New players pick a node with `nodeSelection`:

| Strategy              | Picks                                             |
| --------------------- | ------------------------------------------------- |
| `leastLoad` (default) | The lowest penalty: CPU load, players, frame loss |
| `leastPlayers`        | Fewest players                                    |
| `leastPlayingPlayers` | Fewest playing players                            |
| `leastMemory`         | Least memory used                                 |
| `leastCpu`            | Lowest CPU load                                   |
| `priority`            | Highest `priority`                                |
| `random`              | Any ready node                                    |
| `region`              | A node whose `regions` contain the voice region   |

Or pass a function: `nodeSelection: (nodes, { guildId, region, exclude }) => nodes[0]`.

When your nodes have `regions`, a player moves to a node in its voice region as soon as Discord tells it the region, before the first track plays.

## Moving and failover

`player.moveTo(node)` moves a player and continues at the same position, volume, pause state and filters.

When a node stays disconnected for 10 seconds, or gives up reconnecting, failover moves its players to other nodes, five at a time. It never waits on the dead node. Tune it with `failover: { graceMs, concurrency, enabled }`.

## Raw REST

Anything Lunalink doesn't wrap is still reachable:

```ts
const workers = await node.rest.request("GET", "/v4/workers");
```
