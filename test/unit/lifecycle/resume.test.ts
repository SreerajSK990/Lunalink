import { describe, expect, it, vi } from "vitest";
import { Persistence } from "../../../src/lifecycle/Persistence.js";
import { resumeLive } from "../../../src/lifecycle/resumeLive.js";
import {
  autoTimeoutSeconds,
  listenerPosition,
  restartPosition,
  rewindLead,
} from "../../../src/lifecycle/resumeMath.js";
import { loadQueue, type PlayerSnapshot, takeSnapshot } from "../../../src/lifecycle/snapshot.js";
import type { Player } from "../../../src/player/Player.js";
import type { ApiPlayer } from "../../../src/protocol/index.js";
import { MemoryQueue } from "../../../src/queue/MemoryQueue.js";
import { defaultTrackFactory } from "../../../src/track/toSearchResult.js";
import { Track } from "../../../src/track/Track.js";
import { UnresolvedTrack } from "../../../src/track/UnresolvedTrack.js";
import { MemoryStore } from "../../../src/stores-builtin/MemoryStore.js";
import { track } from "../../mock/fixtures.js";

describe("resume math", () => {
  it("picks the rewind lead from the gap", () => {
    expect(rewindLead(1_000, "auto")).toBe(0);
    expect(rewindLead(10_000, "auto")).toBe(2_000);
    expect(rewindLead(60_000, "auto")).toBe(3_000);
    expect(rewindLead(60_000, 500)).toBe(500);
  });

  it("never restarts before the beginning", () => {
    expect(restartPosition(1_000, 60_000, "auto")).toBe(0);
  });

  it("learns the session timeout from downtimes", () => {
    expect(autoTimeoutSeconds([])).toBe(300);
    expect(autoTimeoutSeconds([1_000])).toBe(60);
    expect(autoTimeoutSeconds([200_000, 300_000])).toBe(600);
    expect(autoTimeoutSeconds([1_000_000])).toBe(900);
  });

  it("caps the listener position at the server position", () => {
    expect(
      listenerPosition({ position: 10_000, at: 0, lastAliveAt: 4_000, serverPosition: null }),
    ).toBe(14_000);
    expect(
      listenerPosition({ position: 10_000, at: 0, lastAliveAt: 4_000, serverPosition: 12_000 }),
    ).toBe(12_000);
  });
});

function fakePlayer(queue: MemoryQueue, current: Track | null): Player {
  return {
    guildId: "1",
    voiceChannelId: "2",
    textChannelId: null,
    node: { id: "main", sessionId: "s1" },
    queue,
    current,
    position: 42_000,
    paused: false,
    playing: true,
    state: "playing",
    volume: 80,
    loop: "queue",
    autoplay: true,
    filters: { state: { volume: 1.2 } },
    resync: vi.fn(() => Promise.resolve()),
    connect: vi.fn(() => Promise.resolve()),
    seek: vi.fn(() => Promise.resolve()),
  } as unknown as Player;
}

describe("snapshots", () => {
  it("round-trips the queue, with requesters and unresolved tracks", async () => {
    const queue = new MemoryQueue({ guildId: "1", emitChange: () => undefined });
    const playing = new Track(track("a"), { id: "u1" });
    queue.add([playing, UnresolvedTrack.create({ title: "Song", author: "Band" })]);
    queue.advance("off");
    const snapshot = await takeSnapshot(fakePlayer(queue, playing));
    expect(snapshot).toMatchObject({
      guildId: "1",
      nodeId: "main",
      position: 42_000,
      loop: "queue",
    });
    const restored = loadQueue(
      JSON.parse(JSON.stringify(snapshot)) as PlayerSnapshot,
      defaultTrackFactory,
    );
    expect(restored.current?.item.kind).toBe("track");
    expect(restored.current?.item.requester).toEqual({ id: "u1" });
    expect(restored.upcoming[0]?.item).toMatchObject({
      kind: "unresolved",
      title: "Song",
      author: "Band",
    });
  });

  it("applies a newer heartbeat when loading", async () => {
    const store = new MemoryStore();
    const queue = new MemoryQueue({ guildId: "1", emitChange: () => undefined });
    const player = fakePlayer(queue, null);
    const persistence = new Persistence({ store, players: () => [player], debug: () => undefined });
    await persistence.save(player);
    store.set("heartbeat:1", { position: 99_000, at: Date.now() + 1_000 });
    const [loaded] = await persistence.loadAll();
    expect(loaded?.position).toBe(99_000);
    await persistence.remove("1");
    expect(await persistence.loadAll()).toEqual([]);
  });
});

function serverPlayer(encoded: string, position: number, connected: boolean): ApiPlayer {
  return {
    guildId: "1",
    track: { ...track("a"), encoded },
    volume: 100,
    paused: false,
    state: { time: 0, position, connected, ping: 0 },
    voice: { token: "t", endpoint: "e", sessionId: "s" },
    filters: {},
  };
}

describe("resumeLive", () => {
  const base = {
    since: Date.now() - 10_000,
    positionAtLoss: 30_000,
    strategy: "auto" as const,
    rewindLeadMs: "auto" as const,
  };

  it("does nothing when the voice stayed up", async () => {
    const current = new Track(track("a"));
    const player = fakePlayer(
      new MemoryQueue({ guildId: "1", emitChange: () => undefined }),
      current,
    );
    const info = await resumeLive(player, {
      ...base,
      server: serverPlayer(current.encoded, 40_000, true),
      resumed: true,
      voiceDropped: false,
    });
    expect(info.mode).toBe("seamless");
    expect(player.connect).not.toHaveBeenCalled();
  });

  it("rejoins and seeks back when the voice dropped", async () => {
    const current = new Track(track("a"));
    const player = fakePlayer(
      new MemoryQueue({ guildId: "1", emitChange: () => undefined }),
      current,
    );
    const info = await resumeLive(player, {
      ...base,
      server: serverPlayer(current.encoded, 40_000, false),
      resumed: true,
      voiceDropped: false,
    });
    expect(info.reason).toBe("voice-dropped-seek-back");
    expect(player.connect).toHaveBeenCalled();
    expect(player.seek).toHaveBeenCalledWith(28_000);
  });

  it("resyncs when the session was lost", async () => {
    const current = new Track(track("a"));
    const player = fakePlayer(
      new MemoryQueue({ guildId: "1", emitChange: () => undefined }),
      current,
    );
    const info = await resumeLive(player, {
      ...base,
      server: null,
      resumed: false,
      voiceDropped: false,
    });
    expect(info.mode).toBe("rebuilt");
    expect(player.resync).toHaveBeenCalledWith(28_000);
  });
});
