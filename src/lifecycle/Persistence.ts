import type { DebugEvent } from "../events/DebugEvent.js";
import type { Player } from "../player/Player.js";
import type { JsonValue } from "../protocol/index.js";
import type { MaybePromise } from "../queue/types.js";
import { isRecord } from "../utils/guards.js";
import {
  defaultRequesterCodec,
  type PlayerSnapshot,
  readSnapshot,
  type RequesterCodec,
  takeSnapshot,
  toJson,
} from "./snapshot.js";

/**
 * The store shape persistence writes to. Every `PlayerStore` fits it.
 */
export interface SnapshotStore {
  /**
   * Reads a value.
   *
   * @param key - The key.
   * @returns The value, or `null`.
   */
  get(key: string): MaybePromise<JsonValue | null>;
  /**
   * Writes a value.
   *
   * @param key - The key.
   * @param value - The value.
   */
  set(key: string, value: JsonValue): MaybePromise<void>;
  /**
   * Removes a value.
   *
   * @param key - The key.
   */
  delete(key: string): MaybePromise<void>;
  /**
   * Lists keys.
   *
   * @param prefix - Only keys that start with this.
   * @returns The keys.
   */
  keys(prefix?: string): MaybePromise<string[]>;
}

/**
 * Persistence settings.
 */
export interface PersistenceOptions {
  /** Gather state changes this long before saving, in milliseconds. Defaults to 250. */
  debounceMs?: number;
  /** Save `{ position, at }` for playing players this often, in milliseconds. Defaults to 5000. */
  heartbeatMs?: number;
  /** Turns requesters into JSON and back. */
  requesterCodec?: RequesterCodec;
}

/**
 * What persistence needs from the Lunalink instance.
 */
export interface PersistenceHost {
  /** Where to save. */
  store: SnapshotStore;
  /** Lists every player, for the heartbeat. */
  players(): Player[];
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

const PLAYER = "player:";
const HEARTBEAT = "heartbeat:";
const SESSION = "session:";
const LAST_ALIVE = "process:lastAliveAt";
const DOWNTIMES = "resume:downtimes";

/**
 * Saves a snapshot of every player on each state change, plus a light position heartbeat, so
 * players can be rebuilt after a restart. Keys: `player:<guildId>`, `heartbeat:<guildId>`,
 * `session:<nodeId>`, `process:lastAliveAt` and `resume:downtimes`.
 */
export class Persistence {
  /** Requester codec in use. */
  readonly codec: RequesterCodec;
  /** Heartbeat interval in milliseconds. */
  readonly heartbeatMs: number;
  readonly #host: PersistenceHost;
  readonly #debounceMs: number;
  readonly #pending = new Map<string, { player: Player; timer: ReturnType<typeof setTimeout> }>();
  #heartbeat: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates the persistence helper.
   *
   * @param host - Store and player list.
   * @param options - Settings.
   */
  constructor(host: PersistenceHost, options: PersistenceOptions = {}) {
    this.#host = host;
    this.#debounceMs = Math.max(0, options.debounceMs ?? 250);
    this.heartbeatMs = Math.max(1_000, options.heartbeatMs ?? 5_000);
    this.codec = options.requesterCodec ?? defaultRequesterCodec;
  }

  /**
   * Schedules a snapshot of a player. Call it on every state change.
   *
   * @param player - The player that changed.
   */
  schedule(player: Player): void {
    if (this.#pending.has(player.guildId)) return;
    const timer = setTimeout(() => {
      this.#pending.delete(player.guildId);
      void this.save(player);
    }, this.#debounceMs);
    timer.unref();
    this.#pending.set(player.guildId, { player, timer });
  }

  /**
   * Saves a snapshot of a player now.
   *
   * @param player - The player.
   */
  async save(player: Player): Promise<void> {
    if (player.state === "destroyed") return;
    try {
      const snapshot = await takeSnapshot(player, this.codec);
      await this.#host.store.set(PLAYER + player.guildId, toJson(snapshot));
    } catch (error) {
      this.#fail("Saving a player snapshot failed", error, player.guildId);
    }
  }

  /**
   * Deletes a guild's snapshot. Call it when the player is destroyed on purpose.
   *
   * @param guildId - Guild id.
   */
  async remove(guildId: string): Promise<void> {
    const pending = this.#pending.get(guildId);
    if (pending) clearTimeout(pending.timer);
    this.#pending.delete(guildId);
    try {
      await this.#host.store.delete(PLAYER + guildId);
      await this.#host.store.delete(HEARTBEAT + guildId);
    } catch (error) {
      this.#fail("Deleting a player snapshot failed", error, guildId);
    }
  }

  /**
   * Starts the position heartbeat.
   */
  start(): void {
    if (this.#heartbeat !== null) return;
    this.#heartbeat = setInterval(() => void this.beat(), this.heartbeatMs);
    this.#heartbeat.unref();
  }

  /**
   * Writes one heartbeat now: the position of every playing player and `lastAliveAt`.
   */
  async beat(): Promise<void> {
    const at = Date.now();
    const store = this.#host.store;
    try {
      for (const player of this.#host.players()) {
        if (player.playing) {
          await store.set(HEARTBEAT + player.guildId, { position: player.position, at });
        }
      }
      await store.set(LAST_ALIVE, at);
    } catch (error) {
      this.#fail("Writing the heartbeat failed", error);
    }
  }

  /**
   * Saves every pending snapshot and one last heartbeat. Call it before shutting down.
   */
  async flush(): Promise<void> {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const { player, timer } of pending) {
      clearTimeout(timer);
      await this.save(player);
    }
    await this.beat();
  }

  /**
   * Stops the heartbeat and drops pending saves without writing them.
   */
  dispose(): void {
    if (this.#heartbeat !== null) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
    for (const { timer } of this.#pending.values()) clearTimeout(timer);
    this.#pending.clear();
  }

  /**
   * Reads every saved snapshot, with the newer heartbeat position applied.
   *
   * @returns The snapshots.
   */
  async loadAll(): Promise<PlayerSnapshot[]> {
    const store = this.#host.store;
    const snapshots: PlayerSnapshot[] = [];
    for (const key of await store.keys(PLAYER)) {
      const snapshot = readSnapshot(await store.get(key));
      if (!snapshot) continue;
      const beat = await store.get(HEARTBEAT + snapshot.guildId);
      if (
        isRecord(beat) &&
        typeof beat["position"] === "number" &&
        typeof beat["at"] === "number"
      ) {
        if (beat["at"] > snapshot.at) {
          snapshot.position = beat["position"];
          snapshot.at = beat["at"];
        }
      }
      snapshots.push(snapshot);
    }
    return snapshots;
  }

  /**
   * Reads when this process was last known alive.
   *
   * @returns Unix milliseconds, or `null`.
   */
  async lastAliveAt(): Promise<number | null> {
    const value = await this.#host.store.get(LAST_ALIVE);
    return typeof value === "number" ? value : null;
  }

  /**
   * Saves a node's session id so the next start can resume it.
   *
   * @param nodeId - Node id.
   * @param sessionId - Session id.
   */
  async saveSession(nodeId: string, sessionId: string): Promise<void> {
    try {
      await this.#host.store.set(SESSION + nodeId, sessionId);
    } catch (error) {
      this.#fail("Saving a session id failed", error);
    }
  }

  /**
   * Reads every saved node session id.
   *
   * @returns Session ids by node id.
   */
  async sessions(): Promise<Map<string, string>> {
    const store = this.#host.store;
    const sessions = new Map<string, string>();
    for (const key of await store.keys(SESSION)) {
      const value = await store.get(key);
      if (typeof value === "string") sessions.set(key.slice(SESSION.length), value);
    }
    return sessions;
  }

  /**
   * Adds a measured downtime, keeping the last 20.
   *
   * @param ms - How long the node was away, in milliseconds.
   * @returns Every stored downtime, oldest first.
   */
  async recordDowntime(ms: number): Promise<number[]> {
    const list = await this.downtimes();
    list.push(Math.max(0, Math.round(ms)));
    const kept = list.slice(-20);
    try {
      await this.#host.store.set(DOWNTIMES, kept);
    } catch (error) {
      this.#fail("Saving downtimes failed", error);
    }
    return kept;
  }

  /**
   * Reads the stored downtimes.
   *
   * @returns Downtimes in milliseconds, oldest first.
   */
  async downtimes(): Promise<number[]> {
    const value = await this.#host.store.get(DOWNTIMES);
    return Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];
  }

  #fail(message: string, error: unknown, guildId?: string): void {
    this.#host.debug({
      scope: guildId ? `persistence:${guildId}` : "persistence",
      level: "warn",
      message,
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
