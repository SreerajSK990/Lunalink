import { describe, expect, it } from "vitest";
import { MemoryQueue } from "../../../src/queue/MemoryQueue.js";
import type { QueueChange } from "../../../src/queue/types.js";
import { Track } from "../../../src/track/Track.js";
import { UnresolvedTrack } from "../../../src/track/UnresolvedTrack.js";
import { track } from "../../mock/fixtures.js";

function makeQueue(historyLimit = 50) {
  const changes: QueueChange[] = [];
  const queue = new MemoryQueue(
    { guildId: "1", emitChange: (change) => changes.push(change) },
    { historyLimit },
  );
  return { queue, changes };
}

const song = (id: string) => new Track(track(id));

describe("MemoryQueue", () => {
  it("gives every slot its own id, so duplicates are removed one at a time", () => {
    const { queue } = makeQueue();
    const same = song("a");
    const [first, second] = queue.add([same, same]);
    expect(first!.id).not.toBe(second!.id);
    expect(queue.remove(second!.id)).toBe(second);
    expect(queue.upcoming()).toEqual([first]);
  });

  it("inserts at a position and reports the change", () => {
    const { queue, changes } = makeQueue();
    queue.add([song("a"), song("b")]);
    queue.add(song("c"), { position: 1 });
    expect(queue.tracks.map((item) => (item as Track).identifier)).toEqual(["a", "c", "b"]);
    expect(changes.at(-1)).toMatchObject({ type: "add", position: 1 });
  });

  it("advances with loop off, track and queue", () => {
    const { queue } = makeQueue();
    queue.add([song("a"), song("b")]);
    expect((queue.advance("off")?.item as Track).identifier).toBe("a");
    expect((queue.advance("track")?.item as Track).identifier).toBe("a");
    expect((queue.advance("queue")?.item as Track).identifier).toBe("b");
    expect(queue.tracks.map((item) => (item as Track).identifier)).toEqual(["a"]);
    expect(queue.history().map((entry) => (entry.item as Track).identifier)).toEqual(["a"]);
  });

  it("returns null when the queue runs out", () => {
    const { queue } = makeQueue();
    queue.add(song("a"));
    queue.advance("off");
    expect(queue.advance("off")).toBeNull();
    expect(queue.current()).toBeNull();
  });

  it("skips ahead and goes back", () => {
    const { queue } = makeQueue();
    queue.add([song("a"), song("b"), song("c")]);
    queue.advance("off");
    expect((queue.skipTo(1)?.item as Track).identifier).toBe("c");
    expect(queue.history().map((entry) => (entry.item as Track).identifier)).toEqual(["b", "a"]);
    expect((queue.back()?.item as Track).identifier).toBe("b");
    expect(queue.tracks.map((item) => (item as Track).identifier)).toEqual(["c"]);
  });

  it("caps history", () => {
    const { queue } = makeQueue(2);
    queue.add([song("a"), song("b"), song("c"), song("d")]);
    for (let i = 0; i < 4; i++) queue.advance("off");
    expect(queue.history()).toHaveLength(2);
  });

  it("moves, swaps, dedupes and sums durations", () => {
    const { queue } = makeQueue();
    queue.add([
      song("a"),
      song("b"),
      song("a"),
      UnresolvedTrack.create({ title: "x", durationMs: 1_000 }),
    ]);
    queue.move(0, 2);
    queue.swap(0, 1);
    expect(queue.removeDuplicates()).toHaveLength(1);
    expect(queue.duration).toBe(180_000 * 2 + 1_000);
  });

  it("snapshots and restores", () => {
    const { queue } = makeQueue();
    queue.add([song("a"), song("b")]);
    queue.advance("off");
    const snapshot = queue.snapshot();
    const { queue: other } = makeQueue();
    other.restore(snapshot);
    expect(other.current()).toBe(snapshot.current);
    expect(other.upcoming()).toEqual(snapshot.upcoming);
  });
});
