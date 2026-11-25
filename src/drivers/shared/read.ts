import { isRecord } from "../../utils/guards.js";

/**
 * Reads a number field, falling back when it's missing or not a finite number.
 *
 * @param source - Object to read from.
 * @param key - Field name.
 * @param fallback - Value to use instead.
 * @returns The number.
 */
export function readNumber(source: unknown, key: string, fallback = 0): number {
  if (!isRecord(source)) return fallback;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a string field.
 *
 * @param source - Object to read from.
 * @param key - Field name.
 * @returns The string, or `null` when missing or not a string.
 */
export function readString(source: unknown, key: string): string | null {
  if (!isRecord(source)) return null;
  const value = source[key];
  return typeof value === "string" ? value : null;
}

/**
 * Reads an array of strings, dropping anything that isn't a string.
 *
 * @param source - Object to read from.
 * @param key - Field name.
 * @returns The strings. Empty when the field is missing.
 */
export function readStringArray(source: unknown, key: string): string[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Reads an array field.
 *
 * @param source - Object to read from.
 * @param key - Field name.
 * @returns The array, or an empty one.
 */
export function readArray(source: unknown, key: string): unknown[] {
  if (!isRecord(source)) return [];
  const value = source[key];
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/**
 * Reads a nested object field.
 *
 * @param source - Object to read from.
 * @param key - Field name.
 * @returns The object, or `undefined`.
 */
export function readRecord(source: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

/**
 * Checks that something looks like a server track: an `encoded` string and an `info` object.
 *
 * @param value - Anything.
 * @returns `true` when it can be used as a track.
 */
export function looksLikeTrack(value: unknown): boolean {
  return isRecord(value) && typeof value["encoded"] === "string" && isRecord(value["info"]);
}
