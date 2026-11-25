/**
 * Formats milliseconds the way music players show time: `3:05`, or `1:02:03` past an hour.
 *
 * @param ms - Duration in milliseconds. Negative values count as 0.
 * @returns The formatted time.
 * @example
 * ```ts
 * formatDuration(185_000);
 * formatDuration(3_723_000);
 * ```
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  return `${minutes}:${paddedSeconds}`;
}

const CLOCK_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/;
const UNIT_PATTERN = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/i;

/**
 * Reads a time that a user typed, for a seek command for example. Accepts `90` (seconds),
 * `1:30`, `1:02:03`, and `1h2m3s` style input.
 *
 * @param input - Text to read.
 * @returns Milliseconds, or `null` when the text isn't a time.
 * @example
 * ```ts
 * parseDuration("1:30");
 * parseDuration("2m");
 * ```
 */
export function parseDuration(input: string): number | null {
  const text = input.trim();
  if (text.length === 0) return null;
  if (/^\d+$/.test(text)) return Number(text) * 1000;

  const clock = CLOCK_PATTERN.exec(text);
  if (clock) {
    const [, hours = "0", minutes = "0", seconds = "0"] = clock;
    if (Number(seconds) > 59 || (clock[1] !== undefined && Number(minutes) > 59)) return null;
    return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
  }

  const units = UNIT_PATTERN.exec(text);
  if (units && (units[1] ?? units[2] ?? units[3]) !== undefined) {
    const [, hours = "0", minutes = "0", seconds = "0"] = units;
    return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
  }
  return null;
}
