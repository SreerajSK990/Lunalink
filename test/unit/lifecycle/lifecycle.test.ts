import { afterEach, describe, expect, it, vi } from "vitest";
import { TypedEmitter } from "../../../src/events/TypedEmitter.js";
import { AutoLeave } from "../../../src/lifecycle/AutoLeave.js";
import {
  sameSourceRecommendations,
  youtubeMix,
  youtubeSearchFallback,
} from "../../../src/lifecycle/autoplayStrategies.js";
import { Failover } from "../../../src/lifecycle/Failover.js";
import type { Node } from "../../../src/node/Node.js";
import type { NodeManager, NodeManagerEvents } from "../../../src/node/NodeManager.js";
import type { Player } from "../../../src/player/Player.js";
import { Track } from "../../../src/track/Track.js";
import { VoiceStateCache } from "../../../src/voice/VoiceStateCache.js";
import { track } from "../../mock/fixtures.js";

function fakeNode(id: string, kind: "lavalink" | "nodelink", sources: string[]): Node {
  return {
    id,
    kind,
    connected: false,
    supports: (capability: string) => sources.some((source) => capability === `source:${source}`),
  } as unknown as Node;
}

describe("autoplay strategies", () => {
  const spotify = new Track(track("abc", { sourceName: "spotify", identifier: "abc" }));
  const youtube = new Track(track("xyz", { sourceName: "youtube", identifier: "xyz" }));

  it("uses the recommendation prefix of the seed's source", () => {
    const node = fakeNode("a", "lavalink", ["spotify"]);
    expect(sameSourceRecommendations.identifiers({ lastTrack: spotify, node })).toEqual([
      "sprec:abc",
    ]);
  });

  it("skips a source the node doesn't have", () => {
    const node = fakeNode("a", "lavalink", ["youtube"]);
    expect(sameSourceRecommendations.identifiers({ lastTrack: spotify, node })).toBeNull();
  });

  it("uses the RD mix on Lavalink and ytrec on NodeLink", () => {
    expect(
      youtubeMix.identifiers({ lastTrack: youtube, node: fakeNode("a", "lavalink", ["youtube"]) }),
    ).toEqual(["https://www.youtube.com/watch?v=xyz&list=RDxyz"]);
    expect(
      youtubeMix.identifiers({ lastTrack: youtube, node: fakeNode("b", "nodelink", ["youtube"]) }),
    ).toEqual(["ytrec:xyz"]);
  });

  it("falls back to a YouTube search", () => {
    const node = fakeNode("a", "lavalink", ["youtube"]);
    const result = youtubeSearchFallback.identifiers({ lastTrack: spotify, node });
    expect(result?.[0]?.startsWith("ytsearch:")).toBe(true);
  });
});

describe("AutoLeave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("destroys a player whose queue stayed empty", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn(() => Promise.resolve());
    const player = {
      guildId: "1",
      current: null,
      voiceChannelId: "2",
      destroy,
    } as unknown as Player;
    const leave = new AutoLeave(
      {
        clientId: () => "9",
        voiceStates: new VoiceStateCache(),
        getPlayer: () => player,
        debug: () => undefined,
      },
      { emptyQueueMs: 1_000 },
    );
    leave.onQueueEnd(player);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(destroy).toHaveBeenCalledWith("autoLeave");
  });

  it("cancels the timer when a track starts", async () => {
    vi.useFakeTimers();
    const destroy = vi.fn(() => Promise.resolve());
    const player = {
      guildId: "1",
      current: null,
      voiceChannelId: "2",
      destroy,
    } as unknown as Player;
    const leave = new AutoLeave(
      {
        clientId: () => "9",
        voiceStates: new VoiceStateCache(),
        getPlayer: () => player,
        debug: () => undefined,
      },
      { emptyQueueMs: 1_000 },
    );
    leave.onQueueEnd(player);
    leave.onTrackStart(player);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(destroy).not.toHaveBeenCalled();
  });
});

describe("Failover", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves players after the grace period, and not before", async () => {
    vi.useFakeTimers();
    const events = new TypedEmitter<NodeManagerEvents>();
    const dead = fakeNode("dead", "lavalink", []);
    const alive = fakeNode("alive", "lavalink", []);
    const moveTo = vi.fn(() => Promise.resolve());
    const player = { guildId: "1", node: dead, moveTo } as unknown as Player;
    const nodes = { events, select: () => alive } as unknown as NodeManager;
    const failover = new Failover(
      { nodes, playersOn: () => [player], debug: () => undefined },
      { graceMs: 10_000 },
    );
    events.emit("nodeDisconnect", dead, 1006, "gone");
    await vi.advanceTimersByTimeAsync(9_000);
    expect(moveTo).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(moveTo).toHaveBeenCalledWith(alive);
    failover.dispose();
  });

  it("cancels when the node comes back in time", async () => {
    vi.useFakeTimers();
    const events = new TypedEmitter<NodeManagerEvents>();
    const node = fakeNode("n", "lavalink", []);
    const moveTo = vi.fn(() => Promise.resolve());
    const player = { guildId: "1", node, moveTo } as unknown as Player;
    const nodes = { events, select: () => node } as unknown as NodeManager;
    const failover = new Failover({ nodes, playersOn: () => [player], debug: () => undefined });
    events.emit("nodeDisconnect", node, 1006, "gone");
    events.emit("nodeReady", node, true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(moveTo).not.toHaveBeenCalled();
    failover.dispose();
  });
});
