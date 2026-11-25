import { describe, expect, it } from "vitest";
import {
  assertNever,
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  isSnowflake,
} from "../../../src/utils/guards.js";
import { deepFreeze } from "../../../src/utils/deepFreeze.js";
import { parseJson } from "../../../src/utils/json.js";

describe("guards", () => {
  it("isRecord accepts plain objects only", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });

  it("isNonEmptyString", () => {
    expect(isNonEmptyString("a")).toBe(true);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString(1)).toBe(false);
  });

  it("isFiniteNumber", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
  });

  it("isSnowflake", () => {
    expect(isSnowflake("170939974227541168")).toBe(true);
    expect(isSnowflake("1234")).toBe(false);
    expect(isSnowflake(170939974227)).toBe(false);
  });

  it("assertNever throws with context", () => {
    expect(() => assertNever("oops" as never, "loadType")).toThrow(/loadType/);
  });
});

describe("parseJson", () => {
  it("returns the value", () => {
    expect(parseJson('{"op":"ready"}')).toEqual({ ok: true, value: { op: "ready" } });
  });

  it("returns the error instead of throwing", () => {
    const result = parseJson("{nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(SyntaxError);
  });
});

describe("deepFreeze", () => {
  it("freezes nested objects and arrays", () => {
    const value = deepFreeze({ track: { info: { title: "a" } }, list: [{ n: 1 }] });
    expect(Object.isFrozen(value.track.info)).toBe(true);
    expect(Object.isFrozen(value.list)).toBe(true);
    expect(Object.isFrozen(value.list[0])).toBe(true);
  });
});
