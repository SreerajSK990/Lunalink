# Events, errors and debugging

## Events

Listen with `lunalink.on(name, listener)`. It returns a function that removes the listener. `once()` and `waitFor(name, { filter, timeoutMs, signal })` work too. A listener that throws is reported in `debug` and never breaks Lunalink.

**Players**

| Event              | Arguments                                                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| `playerCreate`     | `player`                                                                         |
| `playerDestroy`    | `player, reason` (`manual`, `disconnected`, `autoLeave`, `nodeLost`, `shutdown`) |
| `playerConnect`    | `player`                                                                         |
| `playerDisconnect` | `player` (the bot was removed from voice)                                        |
| `playerMove`       | `player, fromChannelId, toChannelId`                                             |
| `playerNodeChange` | `player, fromNodeId, toNodeId`                                                   |
| `playerUpdate`     | `player, state` (position, ping, connected)                                      |
| `playerResumed`    | `player, { mode, reason, gapMs, confidence }`                                    |

**Tracks and queue**

| Event         | Arguments                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `trackStart`  | `player, track`                                                                                                                |
| `trackEnd`    | `player, track, reason` (`finished`, `loadFailed`, `stopped`, `replaced`, `cleanup`, and on NodeLink `gapless`, `crossfading`) |
| `trackError`  | `player, track, { kind, message, exception, cause }`                                                                           |
| `trackStuck`  | `player, track, thresholdMs`                                                                                                   |
| `queueEnd`    | `player, lastTrack`                                                                                                            |
| `queueUpdate` | `player, change`                                                                                                               |
| `voiceClosed` | `player, code, reason, byRemote`                                                                                               |

**Features:** `segmentsLoaded`, `segmentSkipped`, `chaptersLoaded`, `chapterStarted`, `lyricsFound`, `lyricsNotFound`, `lyricsLine`, `nodeLinkEvent`.

**Nodes:** `nodeCreate`, `nodeReady(node, resumed)`, `nodeInfo`, `nodeDisconnect(node, code, reason)`, `nodeReconnecting(node, attempt, delayMs)`, `nodeGiveUp`, `nodeError`, `nodeStats`, `nodePlayerUpdate`, `nodeEvent`, `nodeRaw`, `nodeDestroy`.

**Other:** `pluginError(plugin, label, error)`, `debug(event)`, and plugin events named `<plugin>:<event>`.

## Errors

Everything Lunalink throws is a `LunalinkError` with a `code`, a message written for humans, and `details`.

| Class                     | When                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `ValidationError`         | A bad option or argument. The message names the field                         |
| `UnsupportedFeatureError` | The node lacks a capability. `error.capability` and `error.nodeId` say which  |
| `RestError`               | A REST call failed. Has `method`, `path`, `status`, `body` and `retryAfterMs` |

Codes: `INVALID_OPTION`, `INVALID_ARGUMENT`, `NODE_NOT_FOUND`, `NO_NODES_AVAILABLE`, `NODE_NOT_READY`, `UNAUTHORIZED`, `REST_REQUEST_FAILED`, `REST_TIMEOUT`, `REST_RATE_LIMITED`, `UNSUPPORTED_FEATURE`, `PLAYER_NOT_FOUND`, `PLAYER_DESTROYED`, `VOICE_CONNECTION_TIMEOUT`, `TRACK_LOAD_FAILED`, `PLUGIN_FAILED`, `PLUGIN_CONFLICT`, `STORE_FAILED`, `ABORTED`.

```ts
try {
  await player.lyrics.current();
} catch (error) {
  if (error instanceof UnsupportedFeatureError) return reply("This server has no lyrics.");
  if (error instanceof RestError && error.status === 404) return reply("No lyrics for this track.");
  throw error;
}
```

## Debugging

Lunalink never prints anything. Everything goes to the `debug` event as `{ scope, level, message, data }`:

```ts
lunalink.on("debug", ({ scope, level, message, data }) => {
  if (level !== "trace") console.log(`[${level}] ${scope}: ${message}`, data ?? "");
});
```

Scopes tell you where it came from: `node:<id>`, `player:<guildId>`, `autoplay:<guildId>`, `resume:<guildId>`, `failover`, `persistence`, `plugin:<name>`, `plugins`, `lunalink`.

Useful when something looks wrong:

- `node.capabilities.list()`: what Lunalink thinks the server supports.
- `lunalink.plugins.list()`: plugin status and errors.
- `lunalink.plugins.explain(query)`: which resolver handles a query.
- `checkNodeConformance()` from `lunalink/testing`: whether a server speaks Lavalink v4 the way Lunalink expects.
