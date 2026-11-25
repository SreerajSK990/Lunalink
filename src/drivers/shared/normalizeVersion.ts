import type { NodeVersion } from "../types.js";
import { readNumber, readString, readStringArray } from "./read.js";

/**
 * Normalizes a version object. Lavalink sends `preRelease` and `build` as dot-separated strings
 * (or `null`); NodeLink sends `prerelease` and `build` as arrays. Both end up as arrays.
 *
 * @param raw - The `version` object from `/v4/info`.
 * @returns Normalized version.
 */
export function normalizeVersion(raw: unknown): NodeVersion {
  const semver = readString(raw, "semver") ?? "0.0.0";
  return {
    semver,
    major: readNumber(raw, "major"),
    minor: readNumber(raw, "minor"),
    patch: readNumber(raw, "patch"),
    preRelease: readParts(raw, ["preRelease", "prerelease"]),
    build: readParts(raw, ["build"]),
  };
}

function readParts(raw: unknown, keys: readonly string[]): string[] {
  for (const key of keys) {
    const list = readStringArray(raw, key);
    if (list.length > 0) return list;
    const text = readString(raw, key);
    if (text) return text.split(".");
  }
  return [];
}
