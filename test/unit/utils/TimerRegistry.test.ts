import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerRegistry } from "../../../src/utils/TimerRegistry.js";

describe("TimerRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a timeout once and forgets it", () => {
    const timers = new TimerRegistry();
    const callback = vi.fn();
    timers.timeout(callback, 100);
    expect(timers.size).toBe(1);
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();
    expect(timers.size).toBe(0);
  });

  it("cancels a single timeout", () => {
    const timers = new TimerRegistry();
    const callback = vi.fn();
    const cancel = timers.timeout(callback, 100);
    cancel();
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
    expect(timers.size).toBe(0);
  });

  it("runs an interval until stopped", () => {
    const timers = new TimerRegistry();
    const callback = vi.fn();
    const stop = timers.interval(callback, 50);
    vi.advanceTimersByTime(160);
    expect(callback).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("clears everything at once", () => {
    const timers = new TimerRegistry();
    const callback = vi.fn();
    timers.timeout(callback, 100);
    timers.interval(callback, 100);
    timers.clearAll();
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    expect(timers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
