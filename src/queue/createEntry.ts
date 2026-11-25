import type { QueueItem } from "../track/QueueItem.js";
import type { QueueEntry } from "./types.js";

/**
 * Wraps a track in a queue entry with a fresh id.
 *
 * @param item - The track.
 * @param now - Current time. Defaults to `Date.now()`.
 * @returns The entry.
 */
export function createEntry(item: QueueItem, now: number = Date.now()): QueueEntry {
  return Object.freeze({ id: globalThis.crypto.randomUUID(), item, addedAt: now });
}

/**
 * Shuffles an array in place with the Fisher-Yates algorithm.
 *
 * @param items - Array to shuffle.
 * @param random - Random source returning `[0, 1)`.
 */
export function shuffleInPlace(items: unknown[], random: () => number = Math.random): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = items[index];
    items[index] = items[swapWith];
    items[swapWith] = current;
  }
}
