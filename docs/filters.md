# Filters

```ts
await player.filters.preset("nightcore");
await player.filters.set({ timescale: { speed: 1.2, pitch: 1.1, rate: 1 } });
await player.filters.setEqualizer([
  { band: 0, gain: 0.25 },
  { band: 1, gain: 0.2 },
]);
await player.filters.clear("timescale");
await player.filters.clear();
```

| Call                   | Does                                            |
| ---------------------- | ----------------------------------------------- |
| `set(patch)`           | Changes some filters and keeps the rest         |
| `replace(filters)`     | Replaces every filter                           |
| `clear(...names)`      | Turns the named filters off, or all of them     |
| `preset(name)`         | Applies a preset                                |
| `toggle(name)`         | Turns a preset on or off; returns the new state |
| `isPresetActive(name)` | Whether a preset is on                          |
| `setEqualizer(bands)`  | Sets bands 0–14, gain −0.25 to 1                |
| `active()`             | Names of active filters                         |
| `state`                | The current filters                             |

Values are checked before anything is sent, so a typo fails with `ValidationError` instead of a server error. A filter the node doesn't have throws `UnsupportedFeatureError`; check with `player.supports("filter:echo")`.

## Filters by server

Both: `volume`, `equalizer`, `karaoke`, `timescale`, `tremolo`, `vibrato`, `rotation`, `distortion`, `channelMix`, `lowPass`.

NodeLink only: `highPass`, `echo`, `reverb`, `chorus`, `flanger`, `phaser`, `spatial`, `compressor`, `phonograph`, `tesseract`. Filters from Lavalink plugins (such as LavaDSPX) go in `pluginFilters`.

## Presets

`nightcore`, `vaporwave`, `daycore`, `8d`, `karaoke`, `bassboost`, `treble`, `pop`, `soft`, `tremolo`, `vibrato`, `mono`. `player.filters.presets()` lists them with a one-line description, plus presets added by plugins.

Filters move with the player when it changes node, and are restored after a resume.
