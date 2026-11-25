# Lifecycle

## Auto-leave

Off until you set a timer.

```ts
autoLeave: { emptyQueueMs: 120_000, emptyChannelMs: 60_000 },
```

- `emptyQueueMs`: leave this long after the queue ran out. A new track cancels it.
- `emptyChannelMs`: leave this long after the last person (bots don't count) left the channel. Someone joining cancels it. Lunalink knows who is in a channel from `GUILD_CREATE` and `VOICE_STATE_UPDATE`, so it needs the `GuildVoiceStates` intent.

The player is destroyed with reason `autoLeave`.

## Autoplay

Turn it on per player with `player.setAutoplay(true)`, or for every player with `player: { autoplay: true }`. When the queue runs out, Lunalink tries these strategies in order and queues the first track it hasn't played recently:

1. **Same source:** the source's own recommendations for the last track: `sprec:` (Spotify), `dzrec:` (Deezer), `tdrec:` (Tidal), `qbrec:` (Qobuz), `ymrec:` (Yandex Music), `vkrec:` (VK Music), `jsrec:` (JioSaavn). Needs that source on the node: LavaSrc on Lavalink, built in on NodeLink.
2. **YouTube mix:** for a YouTube track, its `RD` mix playlist on Lavalink, or `ytrec:` on NodeLink.
3. **YouTube search:** "author - title".

A strategy whose source the node doesn't have is skipped, with a `debug` message. Settings: `autoplay: { strategies, batchSize, historySize }`. Plugins add strategies with `ctx.autoplay.register()`. SoundCloud has no server-side recommendations, so it isn't built in.

## Persistence

Lunalink saves a snapshot of every player (track, position, queue, history, volume, filters, loop, autoplay, channels, node) on each change, plus the position of playing players every 5 seconds. Snapshots go to the store:

```ts
import { JsonFileStore } from "lunalink/stores/json-file";

store: new JsonFileStore({ path: "./data/lunalink.json" }),
```

The default `MemoryStore` keeps them only while the process runs, which is enough to resume after a node reconnect but not after a restart. `JsonFileStore` gathers writes for a second and writes atomically (a temporary file, then a rename), so a crash never leaves a broken file.

Any database works: a store is five methods (`get`, `set`, `delete`, `keys`, optional `close`) over JSON values. See `PlayerStore` in the API.

Requesters are saved as JSON. Plain objects come back as they were; a discord.js `User` comes back as a plain object. To store something else, pass `resume: { requesterCodec: { serialize, deserialize } }`.

## Auto-resume

On by default. Lunalink enables resuming on every session and saves session ids, so a node that drops reconnects to the same session, and a restarted bot picks its old sessions up again.

The goal is to continue from where listeners stopped hearing audio, not from wherever the server got to. For each player, the first rule that matches wins:

| Situation                                  | What happens                                                               | `mode`                  |
| ------------------------------------------ | -------------------------------------------------------------------------- | ----------------------- |
| A live stream                              | Rejoin, never seek                                                         | `rejoined`              |
| It was paused                              | Restore paused at the saved position                                       | `rejoined` or `rebuilt` |
| Nobody is in the channel (after a restart) | Rejoin paused, then auto-leave decides                                     | `held`                  |
| The session survived and voice stayed up   | Nothing                                                                    | `seamless`              |
| The session survived, voice dropped        | Rejoin; seek back if the server got more than 1.5 s ahead of the listeners | `rejoined`              |
| The song ended while away                  | Continue with the next track                                               | `advanced`              |
| The session is gone                        | Rebuild from the snapshot on the best node                                 | `rebuilt`               |

When restarting after a gap, playback starts a little before the listener position for context: nothing under 3 seconds, 2 seconds for gaps up to 30 seconds, 3 seconds beyond. The session timeout adapts to your past downtimes (twice the 95th percentile, between 60 and 900 seconds, 300 at first).

Every decision fires `playerResumed(player, { mode, reason, gapMs, confidence })`. `reason` says why, for example `voice-dropped-seek-back` or `session-lost-rebuild`. `confidence` is `low` when the saved position was stale.

Options, all under `resume`:

| Option           | Default  | Meaning                                                             |
| ---------------- | -------- | ------------------------------------------------------------------- |
| `enabled`        | `true`   | Turn it off entirely                                                |
| `strategy`       | `"auto"` | `auto`, or always `listener`, `server` or `snapshot`                |
| `timeoutSeconds` | `"auto"` | Session timeout, or a fixed number                                  |
| `rewindLeadMs`   | `"auto"` | How far before the listener position to restart                     |
| `heartbeatMs`    | `5000`   | Position save interval                                              |
| `nodeWaitMs`     | `15000`  | How long a saved player waits for its node before moving to another |

## Shutting down

```ts
await lunalink.shutdown({ mode: "pause" });
```

`pause` pauses every playing player, saves everything and closes the node connections without deleting the sessions. The next start resumes and unpauses them. Listeners hear a pause, not a skip or a rewind. With `mode: "destroy"` (the default) every player leaves voice and its snapshot is deleted.
