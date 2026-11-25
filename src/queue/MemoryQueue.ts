import { ValidationError } from "../errors/ValidationError.js";
import type { QueueItem } from "../track/QueueItem.js";
import { createEntry, shuffleInPlace } from "./createEntry.js";
import type {
  AddOptions,
  LoopMode,
  Queue,
  QueueContext,
  QueueEntry,
  QueueProvider,
  QueueSnapshot,
} from "./types.js";

/**
 * Settings for {@link MemoryQueue}.
 */
export interface MemoryQueueOptions {
  /** How many played tracks to remember. Defaults to 50. */
  historyLimit?: number;
  /** Most tracks allowed in the upcoming list. Defaults to no limit. */
  maxSize?: number;
}

/**
 * The built-in queue. It lives in memory and every method is synchronous, so you can use it
 * without `await`. Use a store if it should survive restarts.
 *
 * @example
 * ```ts
 * player.queue.add(result.tracks);
 * player.queue.shuffle();
 * console.log(player.queue.length, player.queue.duration);
 * ```
 */
export class MemoryQueue implements Queue {
  /** Guild the queue belongs to. */
  readonly guildId: string;
  readonly #context: QueueContext;
  readonly #historyLimit: number;
  readonly #maxSize: number;
  #current: QueueEntry | null = null;
  #upcoming: QueueEntry[] = [];
  #history: QueueEntry[] = [];

  /**
   * Creates a queue.
   *
   * @param context - Guild id and change reporting.
   * @param options - Limits.
   */
  constructor(context: QueueContext, options: MemoryQueueOptions = {}) {
    this.guildId = context.guildId;
    this.#context = context;
    this.#historyLimit = options.historyLimit ?? 50;
    this.#maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Builds a provider for the `queue` option with custom limits.
   *
   * @param options - Limits.
   * @returns A queue provider.
   */
  static provider(options: MemoryQueueOptions = {}): QueueProvider {
    return (context) => new MemoryQueue(context, options);
  }

  /**
   * Number of upcoming tracks.
   *
   * @returns The count.
   */
  get length(): number {
    return this.#upcoming.length;
  }

  /**
   * Whether nothing is waiting.
   *
   * @returns `true` when the upcoming list is empty.
   */
  get isEmpty(): boolean {
    return this.#upcoming.length === 0;
  }

  /**
   * The current entry.
   *
   * @returns The entry, or `null`.
   */
  get currentEntry(): QueueEntry | null {
    return this.#current;
  }

  /**
   * Upcoming tracks, without their entry wrappers.
   *
   * @returns Tracks in order.
   */
  get tracks(): QueueItem[] {
    return this.#upcoming.map((entry) => entry.item);
  }

  /**
   * Total length of the upcoming tracks in milliseconds. Unresolved tracks without a known
   * length count as 0.
   *
   * @returns Milliseconds.
   */
  get duration(): number {
    return this.#upcoming.reduce((total, entry) => total + itemDuration(entry.item), 0);
  }

  /**
   * The current entry.
   *
   * @returns The entry, or `null`.
   */
  current(): QueueEntry | null {
    return this.#current;
  }

  /**
   * Upcoming entries.
   *
   * @returns A copy of the upcoming list.
   */
  upcoming(): readonly QueueEntry[] {
    return [...this.#upcoming];
  }

  /**
   * Played entries, newest first.
   *
   * @returns A copy of the history.
   */
  history(): readonly QueueEntry[] {
    return [...this.#history];
  }

  /**
   * Number of upcoming tracks.
   *
   * @returns The count.
   */
  size(): number {
    return this.#upcoming.length;
  }

  /**
   * Gets an upcoming entry by index.
   *
   * @param index - Index, negative counts from the end.
   * @returns The entry, or `undefined`.
   */
  at(index: number): QueueEntry | undefined {
    return this.#upcoming.at(index);
  }

  /**
   * Adds tracks.
   *
   * @param items - One track or several.
   * @param options - Where to insert.
   * @returns The new entries.
   * @throws {ValidationError} When the queue would grow past `maxSize`.
   */
  add(items: QueueItem | readonly QueueItem[], options: AddOptions = {}): QueueEntry[] {
    const list = Array.isArray(items) ? (items as readonly QueueItem[]) : [items as QueueItem];
    if (this.#upcoming.length + list.length > this.#maxSize) {
      throw new ValidationError("items", `the queue holds at most ${this.#maxSize} tracks`);
    }
    const entries = list.map((item) => createEntry(item));
    const position = clampIndex(options.position ?? this.#upcoming.length, this.#upcoming.length);
    this.#upcoming.splice(position, 0, ...entries);
    if (entries.length > 0) this.#context.emitChange({ type: "add", entries, position });
    return entries;
  }

  /**
   * Removes one upcoming entry.
   *
   * @param target - Index or entry id.
   * @returns The removed entry, or `null`.
   */
  remove(target: number | string): QueueEntry | null {
    const index =
      typeof target === "number"
        ? target
        : this.#upcoming.findIndex((entry) => entry.id === target);
    if (index < 0 || index >= this.#upcoming.length) return null;
    const [removed] = this.#upcoming.splice(index, 1);
    if (!removed) return null;
    this.#context.emitChange({ type: "remove", entries: [removed] });
    return removed;
  }

  /**
   * Removes a range of upcoming entries.
   *
   * @param start - First index to remove.
   * @param end - Index to stop before.
   * @returns The removed entries.
   */
  removeRange(start: number, end: number): QueueEntry[] {
    const removed = this.#upcoming.splice(start, Math.max(0, end - start));
    if (removed.length > 0) this.#context.emitChange({ type: "remove", entries: removed });
    return removed;
  }

  /**
   * Removes upcoming tracks that appear earlier in the queue, compared by encoded track (or
   * title and author for unresolved tracks).
   *
   * @returns The removed entries.
   */
  removeDuplicates(): QueueEntry[] {
    const seen = new Set<string>();
    const removed: QueueEntry[] = [];
    this.#upcoming = this.#upcoming.filter((entry) => {
      const key = itemKey(entry.item);
      if (seen.has(key)) {
        removed.push(entry);
        return false;
      }
      seen.add(key);
      return true;
    });
    if (removed.length > 0) this.#context.emitChange({ type: "remove", entries: removed });
    return removed;
  }

  /**
   * Moves an upcoming entry.
   *
   * @param from - Current index.
   * @param to - New index.
   * @throws {ValidationError} When `from` is out of range.
   */
  move(from: number, to: number): void {
    const [entry] = this.#upcoming.splice(from, 1);
    if (!entry) throw new ValidationError("from", `no track at position ${from}`);
    const target = clampIndex(to, this.#upcoming.length);
    this.#upcoming.splice(target, 0, entry);
    this.#context.emitChange({ type: "move", entry, from, to: target });
  }

  /**
   * Swaps two upcoming entries.
   *
   * @param first - First index.
   * @param second - Second index.
   * @throws {ValidationError} When either index is out of range.
   */
  swap(first: number, second: number): void {
    const a = this.#upcoming[first];
    const b = this.#upcoming[second];
    if (!a || !b) throw new ValidationError("index", "both positions must exist in the queue");
    this.#upcoming[first] = b;
    this.#upcoming[second] = a;
    this.#context.emitChange({ type: "move", entry: a, from: first, to: second });
  }

  /**
   * Removes every upcoming entry.
   */
  clear(): void {
    const removed = this.#upcoming.length;
    this.#upcoming = [];
    this.#context.emitChange({ type: "clear", removed });
  }

  /**
   * Shuffles the upcoming entries.
   */
  shuffle(): void {
    shuffleInPlace(this.#upcoming);
    this.#context.emitChange({ type: "shuffle" });
  }

  /**
   * Moves to the next track.
   *
   * @param loop - Repeat behavior.
   * @returns The new current entry, or `null`.
   */
  advance(loop: LoopMode): QueueEntry | null {
    const previous = this.#current;
    if (loop === "track" && previous) return previous;
    if (previous) {
      this.#remember(previous);
      if (loop === "queue") this.#upcoming.push(createEntry(previous.item));
    }
    this.#current = this.#upcoming.shift() ?? null;
    this.#context.emitChange({ type: "advance", previous, current: this.#current });
    return this.#current;
  }

  /**
   * Jumps to an upcoming entry.
   *
   * @param index - Index to jump to.
   * @returns The new current entry, or `null` when out of range.
   */
  skipTo(index: number): QueueEntry | null {
    if (index < 0 || index >= this.#upcoming.length) return null;
    const previous = this.#current;
    if (previous) this.#remember(previous);
    for (const skipped of this.#upcoming.splice(0, index)) this.#remember(skipped);
    this.#current = this.#upcoming.shift() ?? null;
    this.#context.emitChange({ type: "advance", previous, current: this.#current });
    return this.#current;
  }

  /**
   * Goes back to the previous track.
   *
   * @returns The new current entry, or `null` when history is empty.
   */
  back(): QueueEntry | null {
    const target = this.#history.shift();
    if (!target) return null;
    const previous = this.#current;
    if (previous) this.#upcoming.unshift(previous);
    this.#current = target;
    this.#context.emitChange({ type: "advance", previous, current: target });
    return target;
  }

  /**
   * Replaces the current entry.
   *
   * @param entry - New current entry, or `null`.
   */
  setCurrent(entry: QueueEntry | null): void {
    this.#current = entry;
    this.#context.emitChange({ type: "setCurrent", entry });
  }

  /**
   * Returns everything in the queue.
   *
   * @returns A snapshot.
   */
  snapshot(): QueueSnapshot {
    return { current: this.#current, upcoming: [...this.#upcoming], history: [...this.#history] };
  }

  /**
   * Replaces everything in the queue.
   *
   * @param snapshot - What to load.
   */
  restore(snapshot: QueueSnapshot): void {
    this.#current = snapshot.current;
    this.#upcoming = [...snapshot.upcoming];
    this.#history = snapshot.history.slice(0, this.#historyLimit);
    this.#context.emitChange({ type: "restore" });
  }

  #remember(entry: QueueEntry): void {
    if (this.#historyLimit <= 0) return;
    this.#history.unshift(entry);
    if (this.#history.length > this.#historyLimit) this.#history.length = this.#historyLimit;
  }
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.trunc(index), length));
}

function itemDuration(item: QueueItem): number {
  return item.kind === "track" ? item.duration : (item.durationMs ?? 0);
}

function itemKey(item: QueueItem): string {
  return item.kind === "track" ? item.encoded : `${item.title}\u0000${item.author ?? ""}`;
}

/**
 * The default queue provider.
 */
export const memoryQueueProvider: QueueProvider = MemoryQueue.provider();
