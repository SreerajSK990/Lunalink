/**
 * Estimates the live playback position between the node's updates. It counts from the moment
 * an update was received locally rather than from the server's timestamp, so clock differences
 * between the bot and the node don't matter.
 */
export class PositionClock {
  #position = 0;
  #receivedAt = Date.now();
  #paused = true;
  #length = Number.POSITIVE_INFINITY;

  /**
   * Estimated position right now, in milliseconds.
   *
   * @param now - Current time. Defaults to `Date.now()`.
   * @returns The position, never past the track's length.
   */
  position(now: number = Date.now()): number {
    const elapsed = this.#paused ? 0 : Math.max(0, now - this.#receivedAt);
    return Math.min(this.#position + elapsed, this.#length);
  }

  /**
   * Records a position from the node or from a local seek.
   *
   * @param position - Position in milliseconds.
   * @param now - When it was true. Defaults to `Date.now()`.
   */
  set(position: number, now: number = Date.now()): void {
    this.#position = Math.max(0, position);
    this.#receivedAt = now;
  }

  /**
   * Pauses or resumes counting.
   *
   * @param paused - Whether playback is paused.
   * @param now - Current time. Defaults to `Date.now()`.
   */
  setPaused(paused: boolean, now: number = Date.now()): void {
    if (paused === this.#paused) return;
    this.#position = this.position(now);
    this.#receivedAt = now;
    this.#paused = paused;
  }

  /**
   * Starts over for a new track.
   *
   * @param length - Track length in milliseconds, or `Infinity` for streams.
   * @param position - Start position.
   * @param paused - Whether it starts paused.
   */
  reset(length: number, position = 0, paused = false): void {
    this.#length = length > 0 ? length : Number.POSITIVE_INFINITY;
    this.#position = position;
    this.#receivedAt = Date.now();
    this.#paused = paused;
  }
}
