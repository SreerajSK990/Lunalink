import { describe, expect, it } from "vitest";
import { detectKind } from "../../src/drivers/detectKind.js";
import { LavalinkDriver } from "../../src/drivers/lavalink/LavalinkDriver.js";
import { NodeLinkDriver } from "../../src/drivers/nodelink/NodeLinkDriver.js";
import {
  normalizeLyricsKt,
  normalizeNodeLinkLyrics,
} from "../../src/drivers/shared/normalizeLyrics.js";
import type { ApiEventBase } from "../../src/protocol/index.js";
import { lavalinkInfo, nodeLinkInfo, stats, track } from "../mock/fixtures.js";

const lavalink = new LavalinkDriver();
const nodelink = new NodeLinkDriver();

function event(type: string, fields: Record<string, unknown> = {}): ApiEventBase {
  return { op: "event", type, guildId: "1", ...fields };
}

describe("detectKind", () => {
  it("spots NodeLink by header or body", () => {
    expect(detectKind(new Headers({ IamNodelink: "true" }), {})).toBe("nodelink");
    expect(detectKind(new Headers(), { isNodelink: true })).toBe("nodelink");
    expect(detectKind(new Headers(), lavalinkInfo())).toBe("lavalink");
  });
});

describe("info and stats", () => {
  it("normalizes both version shapes", () => {
    expect(lavalink.normalizeInfo(lavalinkInfo()).version.preRelease).toEqual([]);
    const nl = nodelink.normalizeInfo(nodeLinkInfo());
    expect(nl.version.preRelease).toEqual(["dev", "1"]);
    expect(nl.runtime).toBe("v22.22.2");
  });

  it("rejects bodies that aren't v4 info", () => {
    expect(() => lavalink.normalizeInfo({ hello: "world" })).toThrow(TypeError);
  });

  it("reads the server load from the right field", () => {
    expect(lavalink.normalizeStats(stats("lavalink"))?.cpu.serverLoad).toBe(0.05);
    expect(nodelink.normalizeStats(stats("nodelink"))?.cpu.serverLoad).toBe(0.05);
  });
});

describe("core events", () => {
  it("marks which end reasons may start the next track", () => {
    const finished = lavalink.normalizeEvent(
      event("TrackEndEvent", { track: track("a"), reason: "finished" }),
    );
    expect(finished).toMatchObject({ type: "trackEnd", mayStartNext: true, handedOff: false });
    const replaced = lavalink.normalizeEvent(
      event("TrackEndEvent", { track: track("a"), reason: "replaced" }),
    );
    expect(replaced).toMatchObject({ mayStartNext: false, handedOff: false });
  });

  it("understands NodeLink's gapless hand-off", () => {
    const gapless = nodelink.normalizeEvent(
      event("TrackEndEvent", { track: track("a"), reason: "gapless" }),
    );
    expect(gapless).toMatchObject({
      type: "trackEnd",
      reason: "gapless",
      mayStartNext: false,
      handedOff: true,
    });
  });

  it("falls back to unknown for malformed events", () => {
    expect(lavalink.normalizeEvent(event("TrackStartEvent")).type).toBe("unknown");
  });

  it("maps WebSocketClosedEvent", () => {
    expect(
      lavalink.normalizeEvent(
        event("WebSocketClosedEvent", { code: 4006, reason: "x", byRemote: true }),
      ),
    ).toEqual({
      type: "voiceClosed",
      guildId: "1",
      code: 4006,
      reason: "x",
      byRemote: true,
    });
  });
});

describe("SponsorBlock events", () => {
  const segment = { category: "sponsor", start: 1_000, end: 5_000 };

  it("reads the Lavalink plugin's event names", () => {
    expect(lavalink.normalizeEvent(event("SegmentsLoaded", { segments: [segment] }))).toMatchObject(
      {
        type: "segmentsLoaded",
        segments: [{ category: "sponsor", start: 1_000, end: 5_000 }],
      },
    );
    expect(
      lavalink.normalizeEvent(
        event("ChapterStarted", { chapter: { name: "Intro", start: 0, end: 10, duration: 10 } }),
      ),
    ).toMatchObject({
      type: "chapterStarted",
      chapter: { name: "Intro", start: 0, end: 10 },
    });
  });

  it("reads NodeLink's event names and keeps the extra fields in raw", () => {
    const nlSegment = { ...segment, uuid: "u1", votes: 3 };
    const loaded = nodelink.normalizeEvent(
      event("SponsorBlockSegmentsLoadedEvent", { segments: [nlSegment] }),
    );
    expect(loaded).toMatchObject({
      type: "segmentsLoaded",
      segments: [{ category: "sponsor", raw: nlSegment }],
    });
    expect(nodelink.normalizeEvent(event("SegmentsLoaded", { segments: [] })).type).toBe("unknown");
  });
});

describe("lyrics", () => {
  it("normalizes live lyrics lines from both backends", () => {
    const line = { timestamp: 1_000, duration: 2_000, line: "hello", plugin: {} };
    for (const driver of [lavalink, nodelink]) {
      expect(
        driver.normalizeEvent(event("LyricsLineEvent", { lineIndex: 0, line, skipped: false })),
      ).toEqual({
        type: "lyricsLine",
        guildId: "1",
        lineIndex: 0,
        line: { text: "hello", start: 1_000, duration: 2_000 },
        skipped: false,
      });
    }
  });

  it("normalizes lyrics.kt timed and text lyrics", () => {
    const base = { track: { title: "t", author: "a", album: null, albumArt: [] }, source: "yt" };
    const timed = normalizeLyricsKt({
      ...base,
      type: "timed",
      lines: [{ line: "x", range: { start: 10, end: 30 } }],
    });
    expect(timed).toMatchObject({ synced: true, lines: [{ text: "x", start: 10, duration: 20 }] });
    const text = normalizeLyricsKt({ ...base, type: "text", text: "a\nb" });
    expect(text).toMatchObject({
      synced: false,
      text: "a\nb",
      lines: [{ text: "a" }, { text: "b" }],
    });
  });

  it("normalizes NodeLink loadlyrics data", () => {
    const lyrics = normalizeNodeLinkLyrics({
      name: "Song",
      synced: true,
      provider: "musixmatch",
      lines: [{ text: "x", time: 5, duration: 6 }],
    });
    expect(lyrics).toMatchObject({
      backend: "nodelink",
      provider: "musixmatch",
      synced: true,
      lines: [{ text: "x", start: 5, duration: 6 }],
    });
  });
});
