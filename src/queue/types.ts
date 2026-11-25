import type { QueueItem } from "../track/QueueItem.js";

/**
 * A value, or a promise of one. Queue methods use it so a database-backed queue can be async
 * while the built-in one stays synchronous.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Repeat behavior.
 *
 * - `off`: play the queue once.
 * - `track`: repeat the current track.
 * - `queue`: when the queue runs out, start over from the first track played.
 */
export type LoopMode = "off" | "track" | "queue";

/**
 * One slot in a queue. The `id` is unique per slot, so the same song added twice gets two
 * different ids and removing one never removes the other.
 */
export interface QueueEntry {
  /** Unique id of this slot. */
  readonly id: string;
  /** The track in this slot. */
  readonly item: QueueItem;
  /** When it was added, in Unix milliseconds. */
  readonly addedAt: number;
}

/**
 * Everything in a queue at one moment.
 */
export interface QueueSnapshot {
  /** What's playing. */
  current: QueueEntry | null;
  /** What's next, in order. */
  upcoming: QueueEntry[];
  /** What already played, newest first. */
  history: QueueEntry[];
}

/**
 * A change a queue reports through {@link QueueContext.emitChange}. Lunalink turns these into
 * `queueUpdate` events.
 */
export type QueueChange =
  | { type: "add"; entries: readonly QueueEntry[]; position: number }
  | { type: "remove"; entries: readonly QueueEntry[] }
  | { type: "move"; entry: QueueEntry; from: number; to: number }
  | { type: "clear"; removed: number }
  | { type: "shuffle" }
  | { type: "advance"; previous: QueueEntry | null; current: QueueEntry | null }
  | { type: "setCurrent"; entry: QueueEntry | null }
  | { type: "restore" };

/**
 * What a queue gets when it's created.
 */
export interface QueueContext {
  /** Guild the queue belongs to. */
  readonly guildId: string;
  /**
   * Reports a change. Custom queues should call it after every change so events keep working.
   *
   * @param change - What changed.
   */
  emitChange(change: QueueChange): void;
}

/**
 * Options for adding to a queue.
 */
export interface AddOptions {
  /** Where to insert, counting from 0 in the upcoming list. Defaults to the end. */
  position?: number;
}

/**
 * The queue contract. The built-in {@link MemoryQueue} implements it, and a plugin can provide
 * another implementation, for example one backed by a database. Lunalink always awaits these
 * methods, so any of them may return a promise.
 */
export interface Queue {
  /** Guild the queue belongs to. */
  readonly guildId: string;
  /**
   * What's playing.
   *
   * @returns The current entry, or `null`.
   */
  current(): MaybePromise<QueueEntry | null>;
  /**
   * What's next, in order.
   *
   * @returns Upcoming entries.
   */
  upcoming(): MaybePromise<readonly QueueEntry[]>;
  /**
   * What already played, newest first.
   *
   * @returns History entries.
   */
  history(): MaybePromise<readonly QueueEntry[]>;
  /**
   * How many tracks are waiting.
   *
   * @returns Upcoming count, not counting the current track.
   */
  size(): MaybePromise<number>;
  /**
   * Adds tracks.
   *
   * @param items - One track or several.
   * @param options - Where to insert.
   * @returns The new entries.
   */
  add(items: QueueItem | readonly QueueItem[], options?: AddOptions): MaybePromise<QueueEntry[]>;
  /**
   * Removes one upcoming entry.
   *
   * @param target - Index in the upcoming list, or an entry id.
   * @returns The removed entry, or `null` when nothing matched.
   */
  remove(target: number | string): MaybePromise<QueueEntry | null>;
  /**
   * Moves an upcoming entry.
   *
   * @param from - Current index.
   * @param to - New index.
   */
  move(from: number, to: number): MaybePromise<void>;
  /**
   * Removes every upcoming entry. The current track and history stay.
   */
  clear(): MaybePromise<void>;
  /**
   * Shuffles the upcoming entries.
   */
  shuffle(): MaybePromise<void>;
  /**
   * Moves to the next track: the current one goes to history (or back into the queue for loop
   * `queue`, or stays for loop `track`) and the next one becomes current.
   *
   * @param loop - Repeat behavior.
   * @returns The new current entry, or `null` when the queue ran out.
   */
  advance(loop: LoopMode): MaybePromise<QueueEntry | null>;
  /**
   * Jumps ahead: entries before `index` go to history and the entry at `index` becomes current.
   *
   * @param index - Index in the upcoming list.
   * @returns The new current entry, or `null` when the index is out of range.
   */
  skipTo(index: number): MaybePromise<QueueEntry | null>;
  /**
   * Goes back: the newest history entry becomes current and the current one returns to the
   * front of the queue.
   *
   * @returns The new current entry, or `null` when history is empty.
   */
  back(): MaybePromise<QueueEntry | null>;
  /**
   * Replaces the current entry without touching the rest, for example after an unresolved
   * track was resolved.
   *
   * @param entry - New current entry, or `null`.
   */
  setCurrent(entry: QueueEntry | null): MaybePromise<void>;
  /**
   * Returns everything in the queue.
   *
   * @returns A snapshot.
   */
  snapshot(): MaybePromise<QueueSnapshot>;
  /**
   * Replaces everything in the queue.
   *
   * @param snapshot - What to load.
   */
  restore(snapshot: QueueSnapshot): MaybePromise<void>;
  /**
   * Releases resources when the player is destroyed. Optional.
   */
  destroy?(): MaybePromise<void>;
}

/**
 * Creates a queue for a player. Plugins provide one to replace the built-in queue.
 *
 * @param context - Guild id and change reporting.
 * @returns The queue.
 */
export type QueueProvider = (context: QueueContext) => Queue;
