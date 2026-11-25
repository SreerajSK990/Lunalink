/**
 * Settings for {@link backoffDelay}.
 */
export interface BackoffOptions {
  /** Delay before the first retry, in milliseconds. */
  baseMs: number;
  /** Longest delay allowed, in milliseconds. */
  maxMs: number;
  /** Random source returning a number in `[0, 1)`. Swap it out in tests. */
  random?: () => number;
}

/**
 * Works out how long to wait before a retry, using exponential backoff with full jitter.
 *
 * The ceiling doubles with each attempt (`baseMs`, `2 × baseMs`, `4 × baseMs`, …) up to `maxMs`,
 * and the actual delay is a random value between 0 and that ceiling. The randomness keeps many
 * bots from reconnecting to a restarted node at the same moment.
 *
 * @param attempt - Retry number, starting at 0.
 * @param options - Base delay, cap and optional random source.
 * @returns Delay in whole milliseconds.
 * @throws {RangeError} When `attempt` is negative or the options are not positive numbers.
 * @example
 * ```ts
 * const wait = backoffDelay(3, { baseMs: 1_000, maxMs: 30_000 });
 * ```
 */
export function backoffDelay(attempt: number, options: BackoffOptions): number {
  const { baseMs, maxMs, random = Math.random } = options;
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError(`attempt must be a non-negative integer, got ${attempt}`);
  }
  if (!(baseMs > 0) || !(maxMs >= baseMs)) {
    throw new RangeError(`expected 0 < baseMs <= maxMs, got baseMs=${baseMs} maxMs=${maxMs}`);
  }
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.min(attempt, 30));
  return Math.floor(random() * ceiling);
}
