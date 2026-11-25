import type { JsonValue } from "../protocol/index.js";

/**
 * A value that may or may not be a promise, so both sync and async stores fit.
 */
export type StoreResult<T> = T | Promise<T>;

/**
 * Where Lunalink keeps player snapshots, resume history and other state that must survive a
 * restart. It's a plain key-value store of JSON values, so any database fits: implement these
 * five methods for Redis, SQLite, Mongo or anything else.
 *
 * Keys are short strings such as `player:<guildId>`. Values are always JSON-safe.
 */
export interface PlayerStore {
  /**
   * Reads a value.
   *
   * @param key - The key.
   * @returns The value, or `null` when there's none.
   */
  get(key: string): StoreResult<JsonValue | null>;
  /**
   * Writes a value, replacing any old one.
   *
   * @param key - The key.
   * @param value - The value.
   */
  set(key: string, value: JsonValue): StoreResult<void>;
  /**
   * Removes a value. Removing a missing key is not an error.
   *
   * @param key - The key.
   */
  delete(key: string): StoreResult<void>;
  /**
   * Lists keys.
   *
   * @param prefix - Only keys that start with this.
   * @returns The keys, in no particular order.
   */
  keys(prefix?: string): StoreResult<string[]>;
  /**
   * Writes anything still pending and releases resources. Called on shutdown.
   */
  close?(): StoreResult<void>;
}
