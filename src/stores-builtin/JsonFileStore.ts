import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PlayerStore } from "../index.js";
import type { JsonObject, JsonValue } from "../protocol/index.js";

/**
 * Settings for {@link JsonFileStore}.
 */
export interface JsonFileStoreOptions {
  /** Path of the JSON file. Its folder is created when missing. */
  path: string;
  /** How long to gather writes before saving, in milliseconds. Defaults to 1000. */
  debounceMs?: number;
}

/**
 * Keeps everything in one JSON file, so players survive a bot restart without a database.
 * Writes are batched and saved atomically: the data goes to a temporary file first, which then
 * replaces the real one, so a crash mid-write never leaves a broken file.
 */
export class JsonFileStore implements PlayerStore {
  readonly #path: string;
  readonly #debounceMs: number;
  #data: Record<string, JsonValue> | null = null;
  #loading: Promise<Record<string, JsonValue>> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #writing: Promise<void> = Promise.resolve();

  /**
   * Creates the store. The file is read on first use.
   *
   * @param options - File path and debounce.
   */
  constructor(options: JsonFileStoreOptions) {
    this.#path = options.path;
    this.#debounceMs = Math.max(0, options.debounceMs ?? 1_000);
  }

  /**
   * Reads a value.
   *
   * @param key - The key.
   * @returns The value, or `null`.
   */
  async get(key: string): Promise<JsonValue | null> {
    const data = await this.#load();
    return data[key] ?? null;
  }

  /**
   * Writes a value and schedules a save.
   *
   * @param key - The key.
   * @param value - The value.
   */
  async set(key: string, value: JsonValue): Promise<void> {
    const data = await this.#load();
    data[key] = JSON.parse(JSON.stringify(value)) as JsonValue;
    this.#schedule();
  }

  /**
   * Removes a value and schedules a save.
   *
   * @param key - The key.
   */
  async delete(key: string): Promise<void> {
    const data = await this.#load();
    if (!(key in data)) return;
    Reflect.deleteProperty(data, key);
    this.#schedule();
  }

  /**
   * Lists keys.
   *
   * @param prefix - Only keys that start with this.
   * @returns The keys.
   */
  async keys(prefix = ""): Promise<string[]> {
    const data = await this.#load();
    return Object.keys(data).filter((key) => key.startsWith(prefix));
  }

  /**
   * Saves pending writes now.
   */
  async flush(): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#data !== null) await this.#save();
  }

  /**
   * Saves pending writes. Call it on shutdown.
   *
   * @returns Resolves once the file is written.
   */
  close(): Promise<void> {
    return this.flush();
  }

  #load(): Promise<Record<string, JsonValue>> {
    if (this.#data !== null) return Promise.resolve(this.#data);
    this.#loading ??= this.#read().then((data) => {
      this.#data = data;
      return data;
    });
    return this.#loading;
  }

  async #read(): Promise<Record<string, JsonValue>> {
    try {
      const parsed = JSON.parse(await readFile(this.#path, "utf8")) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { ...(parsed as JsonObject) };
      }
      return {};
    } catch (error) {
      if (isMissingFile(error)) return {};
      throw error;
    }
  }

  #schedule(): void {
    if (this.#timer !== null) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#save().catch(() => undefined);
    }, this.#debounceMs);
    this.#timer.unref();
  }

  #save(): Promise<void> {
    const snapshot = JSON.stringify(this.#data ?? {});
    this.#writing = this.#writing
      .catch(() => undefined)
      .then(async () => {
        const tmp = `${this.#path}.${String(process.pid)}.tmp`;
        await mkdir(dirname(this.#path), { recursive: true });
        await writeFile(tmp, snapshot, "utf8");
        await rename(tmp, this.#path);
      });
    return this.#writing;
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
