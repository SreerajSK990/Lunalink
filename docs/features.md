# Server features

Each feature works on whichever servers support it and throws `UnsupportedFeatureError` elsewhere. Check the capability first with `player.supports(...)`; lyrics and SponsorBlock also have an `available` getter.

## Lyrics

Works with NodeLink, and with the LavaLyrics or lyrics.kt plugin on Lavalink.

```ts
const lyrics = await player.lyrics.current();
if (lyrics) console.log(lyrics.text, lyrics.lines.length, lyrics.backend);
```

`player.lyrics.get(track)` does the same for any track. `lines` have `text`, `start` and `duration` when the source gives timings. Options: `{ skipTrackSource, language }` (`language` is NodeLink only).

Live lyrics (NodeLink or LavaLyrics, capability `lyrics:live`): `await player.lyrics.subscribe()` emits `lyricsFound`, then `lyricsLine` for each line as it plays. `unsubscribe()` stops it. With lyrics.kt, `player.lyrics.search(query)` finds candidates.

## SponsorBlock

Works with NodeLink and with the SponsorBlock plugin on Lavalink.

```ts
await player.sponsorBlock.setCategories(["sponsor", "selfpromo", "intro"]);
await player.sponsorBlock.getCategories();
await player.sponsorBlock.clear();
```

Events: `segmentsLoaded`, `segmentSkipped`. NodeLink also has `state()`, `configure()` and `setSegments()`.

## Chapters

```ts
const chapters = await player.chapters.get();
```

Each chapter has `name`, `start` and `end`.

Events: `chaptersLoaded`, `chapterStarted`.

## LavaSearch

Albums, artists, playlists and text suggestions in one search. Needs the LavaSearch plugin (capability `search:lavasearch`).

```ts
import { richSearch, defaultTrackFactory } from "lunalink";

const result = await richSearch(
  node,
  "spsearch:daft punk",
  ["track", "album", "artist"],
  user,
  defaultTrackFactory,
);
result?.albums.forEach((album) => console.log(album.name, album.tracks.length));
```

## NodeLink only

On the player, through `player.nodelink`:

| Call                                                                                     | Capability                                                           |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `setCrossfade({ enabled, duration, curve, mode })`                                       | `nodelink:crossfade`                                                 |
| `setFading({ enabled, trackStart, trackEnd, trackStop, seek })`                          | `nodelink:fading`                                                    |
| `setLoudnessNormalizer(bool)`                                                            | `nodelink:loudness`                                                  |
| `setDucking(bool)`                                                                       | `nodelink:fading`                                                    |
| `setNextTrack(track)`                                                                    | `nodelink:gapless` (Lunalink does this for you when `gapless` is on) |
| `mixer.add(track, volume)`, `mixer.list()`, `mixer.setVolume(id, v)`, `mixer.remove(id)` | `nodelink:mixer`                                                     |
| `meaning(track?)`                                                                        | `nodelink:meaning`                                                   |
| `receiveVoice()`                                                                         | `nodelink:voiceReceive`                                              |

For the whole node, `new NodeLinkNodeApi(node)` gives `encodeTrack()`, `encodeTracks()`, `connection()`, `receiveVoice(guildId)` and `liveChat(videoId)`. Endpoints whose shape changes between NodeLink versions aren't wrapped; call them with `node.rest.request()`.

`play(track, { language })` picks an audio language on sources with several dubs (NodeLink).
