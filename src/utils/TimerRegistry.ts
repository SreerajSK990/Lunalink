/**
 * Keeps track of the timeouts and intervals an object starts, so they can all be cleared at once
 * when that object is destroyed. Every Node and Player owns one, which is how Lunalink avoids
 * timers that keep running after a player is gone.
 *
 * @example
 * ```ts
 * const timers = new TimerRegistry();
 * timers.timeout(() => leave(), 60_000);
 * timers.clearAll();
 * ```
 */
export class TimerRegistry {
  readonly #timeouts = new Set<ReturnType<typeof setTimeout>>();
  readonly #intervals = new Set<ReturnType<typeof setInterval>>();

  /**
   * Number of timers that are still pending.
   *
   * @returns Pending timeouts plus active intervals.
   */
  get size(): number {
    return this.#timeouts.size + this.#intervals.size;
  }

  /**
   * Runs `callback` once after `delayMs`.
   *
   * @param callback - Function to run.
   * @param delayMs - Delay in milliseconds.
   * @returns A function that cancels the timeout.
   */
  timeout(callback: () => void, delayMs: number): () => void {
    const handle = setTimeout(() => {
      this.#timeouts.delete(handle);
      callback();
    }, delayMs);
    this.#timeouts.add(handle);
    return () => {
      clearTimeout(handle);
      this.#timeouts.delete(handle);
    };
  }

  /**
   * Runs `callback` every `intervalMs` until it is cancelled.
   *
   * @param callback - Function to run.
   * @param intervalMs - Interval in milliseconds.
   * @returns A function that stops the interval.
   */
  interval(callback: () => void, intervalMs: number): () => void {
    const handle = setInterval(callback, intervalMs);
    this.#intervals.add(handle);
    return () => {
      clearInterval(handle);
      this.#intervals.delete(handle);
    };
  }

  /**
   * Cancels every pending timeout and interval.
   */
  clearAll(): void {
    for (const handle of this.#timeouts) clearTimeout(handle);
    for (const handle of this.#intervals) clearInterval(handle);
    this.#timeouts.clear();
    this.#intervals.clear();
  }
}
