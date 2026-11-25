import { describe, expect, it, vi } from "vitest";
import { TypedEmitter } from "../../../src/events/TypedEmitter.js";

interface Events {
  ping: [value: number];
  done: [];
}

describe("TypedEmitter", () => {
  it("calls listeners in order and reports whether any ran", () => {
    const emitter = new TypedEmitter<Events>();
    const seen: number[] = [];
    emitter.on("ping", (value) => {
      seen.push(value);
    });
    emitter.on("ping", (value) => {
      seen.push(value * 10);
    });
    expect(emitter.emit("ping", 2)).toBe(true);
    expect(emitter.emit("done")).toBe(false);
    expect(seen).toEqual([2, 20]);
  });

  it("removes listeners with the returned function", () => {
    const emitter = new TypedEmitter<Events>();
    const listener = vi.fn();
    const off = emitter.on("ping", listener);
    off();
    emitter.emit("ping", 1);
    expect(listener).not.toHaveBeenCalled();
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("runs once listeners a single time", () => {
    const emitter = new TypedEmitter<Events>();
    const listener = vi.fn();
    emitter.once("ping", listener);
    emitter.emit("ping", 1);
    emitter.emit("ping", 2);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps going when a listener throws or rejects, and reports both", async () => {
    const errors: unknown[] = [];
    const emitter = new TypedEmitter<Events>((error, name) => errors.push([name, error]));
    const after = vi.fn();
    emitter.on("ping", () => {
      throw new Error("sync");
    });
    emitter.on("ping", async () => {
      await Promise.resolve();
      throw new Error("async");
    });
    emitter.on("ping", after);
    emitter.emit("ping", 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(after).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(2);
  });

  it("waitFor resolves with matching arguments", async () => {
    const emitter = new TypedEmitter<Events>();
    const waiting = emitter.waitFor("ping", { filter: (value) => value > 1 });
    emitter.emit("ping", 1);
    emitter.emit("ping", 5);
    await expect(waiting).resolves.toEqual([5]);
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("waitFor times out and cleans up", async () => {
    const emitter = new TypedEmitter<Events>();
    await expect(emitter.waitFor("ping", { timeoutMs: 5 })).rejects.toThrow(/Timed out/);
    expect(emitter.listenerCount("ping")).toBe(0);
  });
});
