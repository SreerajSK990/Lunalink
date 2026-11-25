# Plugins

A plugin is an object with a name, a version, the plugin API version it was written for, and a `setup` function:

```ts
import { definePlugin } from "lunalink/plugin";

export const nowPlayingLog = (prefix = "▶") =>
  definePlugin({
    name: "now-playing-log",
    version: "1.0.0",
    apiVersion: 1,
    setup(ctx) {
      ctx.events.on("trackStart", (player, track) => {
        ctx.logger.info(`${prefix} ${track.title} in ${player.guildId}`);
      });
      return undefined;
    },
  });

new Lunalink({ ..., plugins: [nowPlayingLog()] });
```

Export a factory that takes options, as above, so users can configure the plugin.

## Lifecycle

1. **Register:** the `plugins` option, or `await lunalink.plugins.add(plugin)` at any time.
2. **Validate:** the name must be unique, `apiVersion` must equal `PLUGIN_API_VERSION` (currently 1), dependencies in `dependsOn` must be installed, and slots must not clash.
3. **Setup:** in dependency order during `connect()`, before nodes connect, so resolvers are ready for the first search. `setup` may be async and has 10 seconds (`setupTimeoutMs`). It may return a teardown function.
4. **Active**, until `lunalink.plugins.remove(name)` or `lunalink.shutdown()`.
5. **Teardown**, in reverse order. Everything registered through `ctx` is removed automatically: resolvers, hooks, listeners, interceptors, presets, rules, mappers, backends, slots and timers, and `ctx.signal` aborts.

A plugin that throws or times out in `setup` is marked `failed`, and plugins that depend on it fail too. The others keep working. `lunalink.plugins.list()` shows each plugin's status and error.

Every call into a plugin (resolvers, hooks, listeners, interceptors) is isolated: an error or a timeout (5 seconds by default, `pluginOptions.callTimeoutMs`) is reported as `pluginError` and Lunalink carries on as if the plugin had returned nothing. A broken plugin never stops playback.

## What `ctx` offers

| Member                                                         | Use                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `ctx.lunalink`                                                 | `search()`, `getPlayer()`, `listPlayers()`, `listNodes()`           |
| `ctx.resolvers.register(resolver)`                             | Client-side sources                                                 |
| `ctx.hooks.add(name, hook, { priority })`                      | Middleware                                                          |
| `ctx.autoplay.register(strategy, "first" \| "last")`           | Autoplay strategies                                                 |
| `ctx.filters.registerPreset(preset)`                           | Filter presets                                                      |
| `ctx.capabilities.registerRule(rule)`                          | Capabilities for custom server plugins                              |
| `ctx.events.on / emit / intercept / registerMapper`            | Events                                                              |
| `ctx.backends.register(backend)`                               | Custom playback engines (registered only; see below)                |
| `ctx.slots.set(name, value)`                                   | Replace a part                                                      |
| `ctx.storage`                                                  | Key-value storage namespaced to the plugin, in the configured store |
| `ctx.trackData.get(track)`, `ctx.trackData.with(track, value)` | Per-track plugin data that survives persistence                     |
| `ctx.timers`, `ctx.signal`, `ctx.logger`                       | Cleaned-up timers, an abort signal, a namespaced logger             |

## Resolvers

A resolver turns a query into tracks before the node is asked:

```ts
ctx.resolvers.register({
  name: "radio",
  priority: 10,
  match: (query) => query.startsWith("radio:"),
  resolve: (query, { input, signal }) => ({
    type: "track",
    items: [{ identifier: "https://example.com/stream.mp3" }],
  }),
});
```

Items can be:

- an `UnresolvedTrack` (`UnresolvedTrack.create({ title, author, durationMs, isrc, uri, artworkUrl })`): metadata only. Lunalink finds a playable copy right before it plays.
- a `Track`: already playable.
- `{ identifier }`: something the node can load, such as a direct link or `ytsearch:…`.
- `{ encoded, info }`: a playable track in the node's format.

Matching resolvers run by priority. One that throws, times out or returns nothing passes the query on to the next one, then to the node, unless it sets `fallthrough: false`. Results are shape-checked, and errors name the plugin and the item (`radio/stations: items[3] missing title`). `lunalink.plugins.explain(query)` lists every resolver and whether it matches.

## Hooks

| Hook                                   | Runs                                    | Can return                                              |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `beforeSearch(input)`                  | Before a search                         | A changed input, or a `SearchResult` to skip the search |
| `afterSearch(result, input)`           | After a search                          | A changed result                                        |
| `beforePlay(player, track)`            | Right before a track plays              | Another track, or `null` to skip it                     |
| `afterTrackEnd(player, track, reason)` | After a track ended                     | Nothing                                                 |
| `beforeQueueAdd(player, items)`        | Before items join a queue (synchronous) | The items to add                                        |

Return `undefined` to change nothing. Higher `priority` runs first.

## Events

- `ctx.events.on(name, listener)`: any Lunalink event. Errors are reported, not thrown.
- `ctx.events.emit("myplugin:thing", ...args)`: your own events. Names must start with `<plugin name>:`. Users listen with `lunalink.on("myplugin:thing", …)`. Type them by merging into `LunalinkCustomEvents`:

  ```ts
  declare module "lunalink" {
    interface LunalinkCustomEvents {
      "myplugin:thing": [player: Player, count: number];
    }
  }
  ```

- `ctx.events.intercept(name, (event) => { … }, { priority })`: runs before listeners see an event. Call `event.suppress(reason)` to hide it (for example `trackStart` for a silent intro), or return a promise to hold it until it settles. Arguments can't be changed, so one plugin can't break another; emit your own event instead. Suppression is logged in `debug`. Lunalink's own lifecycle (auto-leave, autoplay, persistence) sees every event, suppressed or not.
- `ctx.events.registerMapper("SomeServerEvent", (payload, player) => ({ name: "myplugin:some", args: [payload] }))`: turns a server event Lunalink doesn't know into a plugin event.

## Slots

A plugin can replace a whole part. List the slots it owns in `slots`, then fill them in `setup`:

```ts
definePlugin({
  name: "redis-queue",
  version: "1.0.0",
  apiVersion: 1,
  slots: ["queue"],
  setup(ctx) {
    ctx.slots.set("queue", (context) => new RedisQueue(context));
    return undefined;
  },
});
```

| Slot            | Contract                                                                 | Default                              |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `queue`         | `QueueProvider`: `(context) => Queue`. Every `Queue` method may be async | `MemoryQueue`                        |
| `store`         | `PlayerStore`                                                            | `MemoryStore` or your `store` option |
| `player`        | A `Player` subclass                                                      | `Player`                             |
| `trackFactory`  | `(api, requester) => Track`                                              | `defaultTrackFactory`                |
| `nodeSelector`  | `(nodes, context) => Node \| undefined`                                  | `leastLoad`                          |
| `mirrorMatcher` | `(wanted, candidates) => Track \| undefined`                             | `pickBestMatch`                      |

Two plugins can't own the same slot; setup fails with `PLUGIN_CONFLICT` naming both, unless one lists the other in `overrides`. The defaults are exported, so you can wrap them instead of starting over.

## Backends

`PlaybackBackend` describes a playback engine other than Lavalink or NodeLink. Backends can be registered and listed (`lunalink.plugins.backends()`), but players aren't routed to them yet.

## Testing a plugin

```ts
import { createHarness, track } from "lunalink/testing";

const harness = await createHarness({ lunalink: { plugins: [myPlugin()] } });
harness.node.loadTracks = () => ({ loadType: "search", data: [track("a")] });
const result = await harness.lunalink.search("radio:lofi");
await harness.stop();
```

See [testing-kit.md](testing-kit.md).
