import { ValidationError } from "../errors/ValidationError.js";
import type { FilterState } from "./types.js";

function check(condition: boolean, field: string, message: string): void {
  if (!condition) throw new ValidationError(`filters.${field}`, message);
}

function within(value: number | undefined, min: number, max: number): boolean {
  return value === undefined || (Number.isFinite(value) && value >= min && value <= max);
}

function positive(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value > 0);
}

function nonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

/**
 * Checks filter values against the ranges in the Lavalink v4 docs, so a bad value fails here
 * with a clear message instead of as an HTTP 400 from the node. NodeLink-only filters aren't
 * range-checked because NodeLink clamps them itself.
 *
 * @param filters - Filters to check.
 * @throws {ValidationError} On the first value out of range.
 */
export function validateFilters(filters: Partial<FilterState>): void {
  check(within(filters.volume, 0, 5), "volume", "must be between 0 and 5");
  for (const [index, band] of (filters.equalizer ?? []).entries()) {
    check(
      Number.isInteger(band.band) && band.band >= 0 && band.band <= 14,
      `equalizer[${index}].band`,
      "must be 0 to 14",
    );
    check(within(band.gain, -0.25, 1), `equalizer[${index}].gain`, "must be between -0.25 and 1");
  }
  const { karaoke, timescale, tremolo, vibrato, channelMix } = filters;
  if (karaoke) {
    check(within(karaoke.level, 0, 1), "karaoke.level", "must be between 0 and 1");
    check(within(karaoke.monoLevel, 0, 1), "karaoke.monoLevel", "must be between 0 and 1");
  }
  if (timescale) {
    check(nonNegative(timescale.speed), "timescale.speed", "must be 0 or more");
    check(nonNegative(timescale.pitch), "timescale.pitch", "must be 0 or more");
    check(nonNegative(timescale.rate), "timescale.rate", "must be 0 or more");
  }
  if (tremolo) {
    check(positive(tremolo.frequency), "tremolo.frequency", "must be above 0");
    check(
      tremolo.depth === undefined || (tremolo.depth > 0 && tremolo.depth <= 1),
      "tremolo.depth",
      "must be above 0 and at most 1",
    );
  }
  if (vibrato) {
    check(
      vibrato.frequency === undefined || (vibrato.frequency > 0 && vibrato.frequency <= 14),
      "vibrato.frequency",
      "must be above 0 and at most 14",
    );
    check(
      vibrato.depth === undefined || (vibrato.depth > 0 && vibrato.depth <= 1),
      "vibrato.depth",
      "must be above 0 and at most 1",
    );
  }
  if (channelMix) {
    for (const key of ["leftToLeft", "leftToRight", "rightToLeft", "rightToRight"] as const) {
      check(within(channelMix[key], 0, 1), `channelMix.${key}`, "must be between 0 and 1");
    }
  }
}
