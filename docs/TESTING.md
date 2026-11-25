# Manual test checklist

Run these against the [example bot](../examples/test-bot) with one Lavalink and one NodeLink node. Check each item on both servers where it applies. On a server that lacks a feature, the bot must answer with a clear "not supported" message, never a stack trace.

Setup:

1. `npm run build` in the repository root.
2. In `examples/test-bot`: `cp .env.example .env`, fill it in, `npm install`, `npm start`.
3. Use `DEV_GUILD_ID` so command changes show up immediately.
4. In a channel, run `/debug log level:info` to watch what Lunalink does.

## Voice

- [ ] `/join` while in a voice channel: the bot joins and names the node it picked.
- [ ] `/join` while not in a voice channel: "Join a voice channel first."
- [ ] `/leave`: the bot leaves; `/nowplaying` then says nothing is playing.
- [ ] Drag the bot to another channel: playback continues; `playerMove` shows in the debug log.
- [ ] Disconnect the bot from voice by hand: the player is destroyed with reason `disconnected`.

## Playback

- [ ] `/play query:<text>`: queues the first result; it starts and "Now playing" is posted.
- [ ] `/play` with a YouTube link, a SoundCloud link and a playlist link: one track, or every playlist track.
- [ ] `/play source:spotify` on a node without Spotify: "Searching spotify needs the spotify source on the node."
- [ ] `/play next:true`: the track goes to the front of the queue.
- [ ] `/play query:radio:lofi`: the radio plugin answers; a live stream starts; `/nowplaying` shows "live".
- [ ] `/pause`, `/resume`: audio stops and continues at the same point.
- [ ] `/skip`, `/skip count:3`: moves one or three tracks ahead.
- [ ] `/previous`: goes back; on the first track, "There is no previous track."
- [ ] `/stop`: stops and clears the queue.
- [ ] `/seek time:1:30`: jumps; on a stream, a clear error.
- [ ] `/volume level:50`, then `level:200`: audibly quieter, then louder.
- [ ] `/loop mode:track`: the track repeats. `mode:queue`: the queue wraps around. `mode:off`.
- [ ] `/autoplay enabled:true`, let the queue run out: a related track is queued. Try YouTube, Spotify and Deezer seeds.
- [ ] `/nowplaying`: title, position, volume, loop, autoplay and node are right.

## Queue

- [ ] `/queue`, `/queue page:2`: lists upcoming tracks, total length and history size.
- [ ] `/remove position:2`: the right track is removed.
- [ ] `/move from:3 to:1`: order changes.
- [ ] `/skipto position:4`: playback jumps to that track.
- [ ] `/shuffle`: order changes.
- [ ] `/dedupe` after queueing the same song twice: one is removed.
- [ ] `/clear`: upcoming list is empty; the current track keeps playing.

## Filters

- [ ] `/filter preset name:nightcore`: faster and higher. Run again: off.
- [ ] Every other preset in the list sounds as described.
- [ ] `/filter equalizer band:0 gain:0.25`: more bass.
- [ ] `/filter speed speed:1.25 pitch:1`: faster, same pitch.
- [ ] `/filter list`: shows the active filters and every preset.
- [ ] `/filter clear`: back to normal.
- [ ] `/movenode` with filters on: the filters stay on.

## Server features

- [ ] `/lyrics`: shows lyrics and the backend (NodeLink, LavaLyrics or lyrics.kt).
- [ ] `/lyrics live:true`: lines are posted as they're sung. `live:false` stops it.
- [ ] `/sponsorblock categories:sponsor,selfpromo` on a YouTube video with a sponsor segment: "Skipped a sponsor segment."
- [ ] `/sponsorblock` with no categories: off.
- [ ] `/chapters` on a video with chapters: timestamps and names.
- [ ] `/richsearch query:<artist>` on a node with LavaSearch: tracks, albums, artists, playlists. Without it: a clear "not supported".

## NodeLink only

On a Lavalink node each of these must answer with "not supported", not an error trace.

- [ ] `/nodelink crossfade ms:5000`: tracks blend into each other. `ms:0`: off.
- [ ] `/nodelink normalizer enabled:true`: loud and quiet tracks sound closer in level.
- [ ] `/nodelink ducking enabled:true`.
- [ ] `/nodelink mix query:<text>`: a second track plays on top of the first.
- [ ] Gapless: with NodeLink, consecutive tracks start without a gap.

## Nodes, failover and resume

- [ ] `/nodes`: both nodes, their kind, version, state, load and player count.
- [ ] `/movenode node:nodelink` while playing on Lavalink (and back): playback continues at the same position.
- [ ] Stop the node a player is on: after about 10 seconds the player moves to the other node and keeps playing.
- [ ] Restart the node within 10 seconds instead: no move; the player resumes ("Resumed (seamless, ...)" or "rejoined").
- [ ] `/restart`: the bot pauses, saves and exits. Start it again: the player rejoins and continues from where it paused.
- [ ] Kill the bot process (no clean shutdown) while playing, start it again within a minute: it rejoins and continues close to where listeners stopped (`rebuilt` or `rejoined`, with a gap).
- [ ] Leave the channel empty during a restart: the player comes back paused (`held`), then auto-leaves.

## Auto-leave

- [ ] Let the queue run out with autoplay off: after 2 minutes the bot leaves and says why.
- [ ] Leave the voice channel so only the bot remains: after 1 minute it leaves. Come back before that: it stays.

## Debug

- [ ] `/debug player`: state, node, position, voice, queue length and filters.
- [ ] `/debug node id:lavalink` and `id:nodelink`: version, session id and capabilities.
- [ ] `/debug plugins`: `radio` is `active`.
- [ ] `/debug explain query:radio:jazz`: handled by `radio/stations`. `query:hello`: handled by the node.
- [ ] `/debug log level:trace`, then `level:off`.
- [ ] `/debug conformance id:lavalink` and `id:nodelink`: every check is PASS.
