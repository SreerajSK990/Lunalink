# Changelog

## 0.1.0 (unreleased)

First release.

- Client for Lavalink v4 and NodeLink with automatic server detection, capability sets and a driver per server. No runtime dependencies; ESM and CommonJS; Node 22+.
- Nodes: reconnect with jittered backoff, session resume, silence detection, eight selection strategies plus custom selectors, voice region routing, failover with a grace period.
- Players: queue with history, loop modes, gapless playback on NodeLink, skip on stuck, a limit on consecutive failures, moving between nodes.
- Search on 29 platforms, link rules, unresolved tracks with a scored mirror step.
- Filters with validation, NodeLink-only filters and 12 presets.
- Lyrics (NodeLink, LavaLyrics, lyrics.kt), SponsorBlock, chapters, LavaSearch, NodeLink crossfade, fading, loudness normalizer, ducking, mixer, voice receive and live chat.
- Lifecycle: auto-leave, autoplay strategies gated by capability, persistence with a memory and an atomic JSON file store, auto-resume that continues from where listeners stopped, planned restarts with `shutdown({ mode: "pause" })`.
- Plugins: resolvers, hooks, autoplay strategies, presets, capability rules, event mappers, event interception, replaceable slots, namespaced storage and track data, isolation with timeouts, automatic cleanup. Plugin API version 1.
- Adapters for discord.js (v14 and the next major), Eris, Oceanic, Seyfert and raw gateways.
- `lunalink/testing`: a mock node, a test harness and a conformance check.
