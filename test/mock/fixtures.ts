import type { ApiTrack } from "../../src/protocol/index.js";

export function lavalinkInfo(plugins: { name: string; version: string }[] = []) {
  return {
    version: { semver: "4.2.2", major: 4, minor: 2, patch: 2, preRelease: null },
    buildTime: 1_700_000_000_000,
    git: { branch: "main", commit: "abc", commitTime: 1_700_000_000_000 },
    jvm: "21.0.2",
    lavaplayer: "2.2.6",
    sourceManagers: ["youtube", "soundcloud", "http"],
    filters: [
      "volume",
      "equalizer",
      "karaoke",
      "timescale",
      "tremolo",
      "vibrato",
      "rotation",
      "distortion",
      "channelMix",
      "lowPass",
    ],
    plugins,
  };
}

export function nodeLinkInfo() {
  return {
    version: {
      semver: "3.10.0-dev.1",
      major: 3,
      minor: 10,
      patch: 0,
      prerelease: ["dev", "1"],
      build: [],
    },
    buildTime: 1_700_000_000_000,
    git: { branch: "main", commit: "def", commitTime: 1_700_000_000_000 },
    node: "v22.22.2",
    voice: { name: "@performanc/voice", version: "1.0.0" },
    isNodelink: true,
    sourceManagers: ["youtube", "spotify", "deezer", "soundcloud"],
    filters: [
      "tremolo",
      "vibrato",
      "lowpass",
      "highpass",
      "rotation",
      "karaoke",
      "distortion",
      "channelMix",
      "equalizer",
      "chorus",
      "compressor",
      "echo",
      "phaser",
      "timescale",
    ],
    plugins: [],
    sourceHealth: { enabled: false },
  };
}

export function stats(kind: "lavalink" | "nodelink", players = 0, playingPlayers = 0) {
  return {
    players,
    playingPlayers,
    uptime: 1_000,
    memory: { free: 1, used: 2, allocated: 3, reservable: 4 },
    cpu:
      kind === "lavalink"
        ? { cores: 4, systemLoad: 0.1, lavalinkLoad: 0.05 }
        : { cores: 4, systemLoad: 0.1, nodelinkLoad: 0.05 },
  };
}

export function track(id: string, overrides: Partial<ApiTrack["info"]> = {}): ApiTrack {
  return {
    encoded: `encoded-${id}`,
    info: {
      identifier: id,
      isSeekable: true,
      author: `Artist ${id}`,
      length: 180_000,
      isStream: false,
      position: 0,
      title: `Song ${id}`,
      uri: `https://example.com/${id}`,
      sourceName: "youtube",
      artworkUrl: null,
      isrc: null,
      ...overrides,
    },
    pluginInfo: {},
    userData: {},
  };
}
