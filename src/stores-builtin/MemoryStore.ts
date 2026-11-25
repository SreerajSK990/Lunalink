import type { PlayerStore } from "../index.js";
import type { JsonValue } from "../protocol/index.js";

/**
 * Keeps everything in memory. It's the default: nothing survives a restart, but players still
 * resume after a node reconnect.
 */
export class MemoryStore implements PlayerStore {
  readonly #data = new Map<string, string>();

  /**
   * Reads a value.
   *
   * @param key - The key.
   * @returns A copy of the value, or `null`.
   */
  get(key: string): JsonValue | null {
    const raw = this.#data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as JsonValue);
  }

  /**
   * Writes a copy of a value.
   *
   * @param key - The key.
   * @param value - The value.
   */
  set(key: string, value: JsonValue): void {
    this.#data.set(key, JSON.stringify(value));
  }

  /**
   * Removes a value.
   *
   * @param key - The key.
   */
  delete(key: string): void {
    this.#data.delete(key);
  }

  /**
   * Lists keys.
   *
   * @param prefix - Only keys that start with this.
   * @returns The keys.
   */
  keys(prefix = ""): string[] {
    return [...this.#data.keys()].filter((key) => key.startsWith(prefix));
  }
}
