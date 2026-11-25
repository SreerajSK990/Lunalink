# Searching

```ts
const result = await lunalink.search("lofi hip hop", { source: "youtubeMusic", requester: user });
```

`result.type` is `track` (a link to one track), `playlist` (`result.playlist` has the name), `search`, `empty` or `error` (`result.error` explains). `result.tracks` holds the tracks.

## Sources

Text gets the prefix of `source`, or of `defaultSearchSource` (default `youtube`). Links and text that already has a prefix (`scsearch:lofi`) are sent as they are.

Built-in platform names: `youtube`, `youtubeMusic`, `soundcloud`, `bandcamp`, `spotify`, `appleMusic`, `deezer`, `deezerIsrc`, `tidal`, `qobuz`, `qobuzIsrc`, `yandexMusic`, `vkMusic`, `jioSaavn`, `amazonMusic`, `pandora`, `audius`, `gaana`, `mixcloud`, `audiomack`, `anghami`, `netease`, `qqMusic`, `shazam`, `bilibili`, `niconico`, `lastfm`, `iheartradio`, `googleDrive`.

Searching a platform the node can't serve throws `UnsupportedFeatureError` before any request is made. Spotify, Deezer and the other music services need LavaSrc on Lavalink. NodeLink has most of them built in.

Pick the node with `{ nodeId: "eu-1" }`. Otherwise the best ready node answers.

## Link rules

```ts
linkRules: { allowLinks: true, allow: ["youtube.com", "youtu.be"], deny: [/\/shorts\//] }
```

Strings match the host name and its subdomains; regular expressions match the whole link. A refused link throws `ValidationError`.

## Unresolved tracks

A plugin resolver can return an `UnresolvedTrack`: a song known by title, author, length and maybe ISRC, but not yet playable. Queue it like any track. Right before it plays, Lunalink finds a playable copy (an ISRC search, then an "author - title" search, scored by length and title) and keeps the original's title, artwork and link for display.

`result.tracks` from `lunalink.search()` can contain both kinds. Check `item.kind` (`"track"` or `"unresolved"`) when the difference matters; `title`, `author`, `uri` and `artworkUrl` exist on both. Length is `track.duration` and `unresolved.durationMs`.

## Search hooks

Plugins can change a search before and after it runs (`beforeSearch`, `afterSearch`) or answer it themselves with a resolver. See [plugins.md](plugins.md). `lunalink.plugins.explain(query)` shows which resolver would handle a query.
