import { describe, expect, it } from "vitest";
import { PositionClock } from "../../../src/player/PositionClock.js";

describe("PositionClock", () => {
  it("counts forward from the last update while playing", () => {
    const clock = new PositionClock();
    clock.reset(180_000, 0, false);
    clock.set(10_000, 1_000);
    expect(clock.position(3_500)).toBe(12_500);
  });

  it("stands still while paused", () => {
    const clock = new PositionClock();
    clock.reset(180_000, 0, false);
    clock.set(10_000, 1_000);
    clock.setPaused(true, 2_000);
    expect(clock.position(9_000)).toBe(11_000);
  });

  it("never runs past the track length", () => {
    const clock = new PositionClock();
    clock.reset(5_000, 0, false);
    clock.set(4_000, 0);
    expect(clock.position(60_000)).toBe(5_000);
  });

  it("treats a zero length as a stream", () => {
    const clock = new PositionClock();
    clock.reset(0, 0, false);
    clock.set(0, 0);
    expect(clock.position(10_000)).toBe(10_000);
  });
});
