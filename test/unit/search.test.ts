import { describe, expect, it } from "vitest";
import { CapabilitySet } from "../../src/capabilities/CapabilitySet.js";
import { ErrorCode } from "../../src/errors/ErrorCode.js";
import { buildIdentifier } from "../../src/search/buildIdentifier.js";
import { assertLinkAllowed } from "../../src/search/linkRules.js";
import { mirrorQueries, pickBestMatch } from "../../src/search/mirror.js";
import { readTypedPrefix } from "../../src/search/platforms.js";
import { toSearchResult } from "../../src/track/toSearchResult.js";
import { Track } from "../../src/track/Track.js";
import { UnresolvedTrack } from "../../src/track/UnresolvedTrack.js";
import { track } from "../mock/fixtures.js";

const caps = new CapabilitySet("main", ["source:youtube", "source:soundcloud"]);
const base = {
  source: undefined,
  defaultSource: "youtube" as const,
  linkRules: {},
  capabilities: caps,
  nodeId: "main",
};

describe("buildIdentifier", () => {
  it("adds the default prefix", () => {
    expect(buildIdentifier(" lofi ", base)).toBe("ytsearch:lofi");
  });

  it("uses the chosen platform", () => {
    expect(buildIdentifier("lofi", { ...base, source: "soundcloud" })).toBe("scsearch:lofi");
  });

  it("keeps a prefix the user typed and passes links through", () => {
    expect(buildIdentifier("scsearch:lofi", base)).toBe("scsearch:lofi");
    expect(buildIdentifier("https://youtu.be/dQw4w9WgXcQ", base)).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
  });

  it("refuses platforms the node can't serve", () => {
    expect(() => buildIdentifier("lofi", { ...base, source: "spotify" })).toThrow(
      expect.objectContaining({ code: ErrorCode.UnsupportedFeature }) as Error,
    );
  });

  it("refuses empty queries", () => {
    expect(() => buildIdentifier("  ", base)).toThrow(/empty/);
  });

  it("reads typed prefixes but not links", () => {
    expect(readTypedPrefix("ytmsearch:abc")).toBe("ytmsearch");
    expect(readTypedPrefix("https://x.com")).toBeNull();
    expect(readTypedPrefix("Song: The Remix")).toBeNull();
  });
});

describe("link rules", () => {
  it("applies allow and deny lists to host names", () => {
    expect(() => {
      assertLinkAllowed("https://www.youtube.com/watch?v=1", { allow: ["youtube.com"] });
    }).not.toThrow();
    expect(() => {
      assertLinkAllowed("https://evil.example/x", { allow: ["youtube.com"] });
    }).toThrow();
    expect(() => {
      assertLinkAllowed("https://m.soundcloud.com/x", { deny: ["soundcloud.com"] });
    }).toThrow();
    expect(() => {
      assertLinkAllowed("https://a.com", { allowLinks: false });
    }).toThrow(/turned off/);
  });
});

describe("mirror", () => {
  const wanted = UnresolvedTrack.create({
    title: "Blinding Lights",
    author: "The Weeknd",
    durationMs: 200_000,
    isrc: "USUG1-1904206",
  });

  it("tries ISRC first, like LavaSrc", () => {
    expect(mirrorQueries(wanted)).toEqual([
      'ytsearch:"USUG11904206"',
      "ytsearch:Blinding Lights The Weeknd",
    ]);
  });

  it("prefers the matching version over a live or long one", () => {
    const live = new Track(
      track("1", {
        title: "The Weeknd - Blinding Lights (Live)",
        author: "The Weeknd",
        length: 200_000,
      }),
    );
    const right = new Track(
      track("2", {
        title: "The Weeknd - Blinding Lights",
        author: "TheWeekndVEVO",
        length: 201_000,
      }),
    );
    const long = new Track(
      track("3", { title: "Blinding Lights 10 hours", author: "x", length: 36_000_000 }),
    );
    expect(pickBestMatch(wanted, [live, long, right])).toBe(right);
  });
});

describe("toSearchResult", () => {
  it("maps every load type", () => {
    expect(
      toSearchResult({ loadType: "track", data: track("a") }, "main", undefined).tracks,
    ).toHaveLength(1);
    const playlist = toSearchResult(
      {
        loadType: "playlist",
        data: {
          info: { name: "Mix", selectedTrack: -1 },
          pluginInfo: {},
          tracks: [track("a"), track("b")],
        },
      },
      "main",
      "user",
    );
    expect(playlist).toMatchObject({ type: "playlist", playlist: { name: "Mix" }, nodeId: "main" });
    expect(playlist.tracks[1]?.requester).toBe("user");
    expect(toSearchResult({ loadType: "empty", data: null }, "main", undefined).type).toBe("empty");
    expect(
      toSearchResult(
        {
          loadType: "error",
          data: { message: "x", severity: "common", cause: "c", causeStackTrace: "" },
        },
        "main",
        undefined,
      ).error?.message,
    ).toBe("x");
  });

  it("keeps mirrored tracks' original metadata", () => {
    const origin = UnresolvedTrack.create({
      title: "Original",
      author: "Artist",
      artworkUrl: "https://art",
    });
    const mirrored = new Track(track("yt"), undefined, origin);
    expect(mirrored.title).toBe("Original");
    expect(mirrored.artworkUrl).toBe("https://art");
    expect(mirrored.sourceName).toBe("youtube");
  });
});
