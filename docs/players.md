# Players and the queue

One guild has at most one player. `lunalink.players` holds them all.

```ts
const player = lunalink.players.create({ guildId, voiceChannelId, textChannelId });
lunalink.players.get(guildId);
lunalink.players.require(guildId);
lunalink.players.list();
```

`get()` returns `undefined` when the guild has no player; `require()` throws `PLAYER_NOT_FOUND`.

`create()` options: `guildId`, `voiceChannelId`, `textChannelId`, `selfDeaf` (default `true`), `selfMute`, `volume`, `loop`, `autoplay`, and `nodeId` to pin a node.

## Voice

| Call                               | Does                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `await player.connect()`           | Joins the channel from the options and waits for Discord's voice packets. Throws `VOICE_CONNECTION_TIMEOUT` if they don't come |
| `await player.setVoiceChannel(id)` | Moves the bot to another channel                                                                                               |
| `await player.destroy()`           | Leaves voice and deletes the player on the node                                                                                |
| `player.voice.connected`           | Whether voice credentials reached the node                                                                                     |

If Discord closes the voice connection with code 4006, the player rejoins on its own.

## Playback

| Call                                          | Does                                               |
| --------------------------------------------- | -------------------------------------------------- |
| `play()`                                      | Starts the queue if nothing plays                  |
| `play(track, { startTime, endTime, paused })` | Plays a track now; the current one goes to history |
| `skip(count?)`                                | Next track, or several ahead                       |
| `previous()`                                  | Back to the last played track                      |
| `stop(clearQueue?)`                           | Stops the track, optionally clears the queue       |
| `pause()`, `resume()`, `setPaused(bool)`      | Pause control                                      |
| `seek(ms)`                                    | Jump within the track; throws for streams          |
| `setVolume(0–1000)`                           | 100 is normal                                      |
| `setLoop("off" \| "track" \| "queue")`        | Loop mode                                          |
| `setAutoplay(bool)`                           | Related tracks when the queue runs out             |
| `moveTo(node)`                                | Continue on another node                           |

Read-only state: `current`, `position` (counts forward between server updates), `state` (`idle`, `playing`, `paused`, `destroyed`), `playing`, `paused`, `volume`, `loop`, `autoplay`, `node`, `voiceChannelId`. `player.data` is a `Map` for your own values.

Player defaults are set with the `player` option of `new Lunalink()`:

| Option                 | Default | Meaning                                                                            |
| ---------------------- | ------- | ---------------------------------------------------------------------------------- |
| `volume`               | `100`   | Starting volume                                                                    |
| `autoplay`             | `false` | Autoplay for new players                                                           |
| `skipOnStuck`          | `true`  | Skip a track the node reports as stuck                                             |
| `maxConsecutiveErrors` | `3`     | Stop after this many failed tracks in a row, so a broken source can't loop forever |
| `gapless`              | `true`  | On NodeLink, hand the next track over early so it starts without a gap             |
| `voiceTimeoutMs`       | `15000` | How long `connect()` waits for Discord                                             |

A track that fails to load or play is reported as `trackError` and skipped.

## The queue

`player.queue` is a `MemoryQueue` unless a plugin replaced it. Its methods are synchronous.

| Call                                            | Does                                          |
| ----------------------------------------------- | --------------------------------------------- |
| `add(item \| items, { position })`              | Adds to the end, or at `position` (0 is next) |
| `remove(index \| entryId)`                      | Removes one entry                             |
| `removeRange(start, end)`, `removeDuplicates()` | Bulk removal                                  |
| `move(from, to)`, `swap(a, b)`                  | Reorder                                       |
| `shuffle()`, `clear()`                          | Shuffle or empty the upcoming list            |
| `tracks`, `length`, `isEmpty`, `duration`       | The upcoming list                             |
| `current()`, `upcoming()`, `history()`          | Entries with ids and add times                |

History keeps the last 50 tracks. Change limits with `structures: { queue: MemoryQueue.provider({ historyLimit, maxSize }) }`.

Each change fires `queueUpdate` with a typed change (`add`, `remove`, `move`, `clear`, `shuffle`, `advance`, `setCurrent`, `restore`).

A queue from a plugin may be async (for example backed by a database). Then await its methods. Type them with declaration merging:

```ts
declare module "lunalink" {
  interface Register {
    queue: MyQueue;
  }
}
```

## Your own player class

```ts
class MusicPlayer extends Player {
  async fadeOutAndStop() {
    for (let volume = this.volume; volume > 0; volume -= 10) {
      await this.setVolume(volume);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await this.stop();
  }
}
new Lunalink({ ..., structures: { player: MusicPlayer } });
```
