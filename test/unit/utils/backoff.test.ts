import { describe, expect, it } from "vitest";
import { backoffDelay } from "../../../src/utils/backoff.js";

describe("backoffDelay", () => {
  const options = { baseMs: 1_000, maxMs: 30_000 };

  it("doubles the ceiling with each attempt", () => {
    const top = { ...options, random: () => 0.999_999 };
    expect(backoffDelay(0, top)).toBe(999);
    expect(backoffDelay(1, top)).toBe(1_999);
    expect(backoffDelay(3, top)).toBe(7_999);
  });

  it("never goes past maxMs", () => {
    const top = { ...options, random: () => 0.999_999 };
    expect(backoffDelay(10, top)).toBeLessThan(30_000);
    expect(backoffDelay(10_000, top)).toBeLessThan(30_000);
  });

  it("can return zero, which is what full jitter means", () => {
    expect(backoffDelay(5, { ...options, random: () => 0 })).toBe(0);
  });

  it("rejects bad input", () => {
    expect(() => backoffDelay(-1, options)).toThrow(RangeError);
    expect(() => backoffDelay(1.5, options)).toThrow(RangeError);
    expect(() => backoffDelay(0, { baseMs: 0, maxMs: 10 })).toThrow(RangeError);
    expect(() => backoffDelay(0, { baseMs: 10, maxMs: 5 })).toThrow(RangeError);
  });
});
