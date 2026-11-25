import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "../../../src/utils/duration.js";

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5_000, "0:05"],
    [185_000, "3:05"],
    [3_723_000, "1:02:03"],
    [-10, "0:00"],
    [59_999, "0:59"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("parseDuration", () => {
  it.each([
    ["90", 90_000],
    ["1:30", 90_000],
    ["01:02:03", 3_723_000],
    ["2m", 120_000],
    ["1h2m3s", 3_723_000],
    ["45s", 45_000],
    [" 1:05 ", 65_000],
  ])("reads %s as %i ms", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "abc", "1:75", "1:61:00", "1:2:3:4", "m"])("rejects %s", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});
