import type { FilterState } from "../filters/types.js";
import type { Player } from "../player/Player.js";
import type { ApiTrack, JsonObject, JsonValue } from "../protocol/index.js";
import type { LoopMode, Queue, QueueEntry, QueueSnapshot } from "../queue/types.js";
import type { Requester } from "../track/Register.js";
import type { TrackFactory } from "../track/toSearchResult.js";
import { UnresolvedTrack, type UnresolvedTrackInput } from "../track/UnresolvedTrack.js";
import { isRecord } from "../utils/guards.js";

/**
 * Turns requesters into JSON and back, so they survive a restart. The default keeps a requester
 * when it converts to JSON, which is enough for plain objects and for discord.js `User` (its
 * `toJSON()` output comes back as a plain object, not a `User`).
 */
export interface RequesterCodec {
  /**
   * Converts a requester to JSON.
   *
   * @param requester - The requester.
   * @returns A JSON value, or `undefined` to drop it.
   */
  serialize(requester: Requester): JsonValue | undefined;
  /**
   * Converts saved JSON back to a requester.
   *
   * @param value - The saved value.
   * @returns The requester.
   */
  deserialize(value: JsonValue): Requester;
}

/**
 * The default {@link RequesterCodec}.
 */
export const defaultRequesterCodec: RequesterCodec = {
  serialize: (requester) => {
    if (requester === undefined) return undefined;
    try {
      return toJson(requester);
    } catch {
      return undefined;
    }
  },
  deserialize: (value) => value,
};

/**
 * A queue item as saved in a snapshot.
 */
export interface SavedItem {
  /** `track` for a playable track, `unresolved` for one that still needs resolving. */
  kind: "track" | "unresolved";
  /** The track, for `track` items. */
  track?: ApiTrack;
  /** The input, for `unresolved` items. */
  input?: Omit<UnresolvedTrackInput, "requester">;
  /** The serialized requester. */
  requester?: JsonValue;
}

/**
 * A queue entry as saved in a snapshot.
 */
export interface SavedEntry {
  /** Entry id. */
  id: string;
  /** When it was added. */
  addedAt: number;
  /** The item. */
  item: SavedItem;
}

/**
 * Everything needed to rebuild a player after a restart.
 */
export interface PlayerSnapshot {
  /** Snapshot format version. */
  version: 1;
  /** Guild id. */
  guildId: string;
  /** Voice channel the bot was in. */
  voiceChannelId: string | null;
  /** Text channel you set. */
  textChannelId: string | null;
  /** Node the player was on. */
  nodeId: string;
  /** That node's session id when the snapshot was taken. */
  sessionId: string | null;
  /** Queue: current entry. */
  current: SavedEntry | null;
  /** Queue: upcoming entries. */
  upcoming: SavedEntry[];
  /** Queue: history, newest first. */
  history: SavedEntry[];
  /** Position in milliseconds. */
  position: number;
  /** When `position` was read, in Unix milliseconds. */
  at: number;
  /** Whether it was paused. */
  paused: boolean;
  /** Volume. */
  volume: number;
  /** Loop mode. */
  loop: LoopMode;
  /** Autoplay on or off. */
  autoplay: boolean;
  /** Active filters. */
  filters: FilterState;
}

/**
 * Converts a value to plain JSON.
 *
 * @param value - Any JSON-safe value, including objects with `toJSON()`.
 * @returns The JSON value.
 */
export function toJson(value: unknown): JsonValue {
  const text = JSON.stringify(value) as string | undefined;
  return text === undefined ? null : (JSON.parse(text) as JsonValue);
}

/**
 * Takes a snapshot of a player.
 *
 * @param player - The player.
 * @param codec - Requester codec.
 * @returns The snapshot.
 */
export async function takeSnapshot(
  player: Player,
  codec: RequesterCodec = defaultRequesterCodec,
): Promise<PlayerSnapshot> {
  const queue: Queue = player.queue;
  const state = await queue.snapshot();
  const save = (entry: QueueEntry): SavedEntry => saveEntry(entry, codec);
  return {
    version: 1,
    guildId: player.guildId,
    voiceChannelId: player.voiceChannelId,
    textChannelId: player.textChannelId,
    nodeId: player.node.id,
    sessionId: player.node.sessionId,
    current: state.current ? save(state.current) : null,
    upcoming: state.upcoming.map(save),
    history: state.history.map(save),
    position: player.position,
    at: Date.now(),
    paused: player.paused,
    volume: player.volume,
    loop: player.loop,
    autoplay: player.autoplay,
    filters: { ...player.filters.state },
  };
}

/**
 * Rebuilds a queue snapshot from saved entries.
 *
 * @param snapshot - The player snapshot.
 * @param factory - Builds tracks.
 * @param codec - Requester codec.
 * @returns The queue snapshot, ready for `queue.restore()`.
 */
export function loadQueue(
  snapshot: PlayerSnapshot,
  factory: TrackFactory,
  codec: RequesterCodec = defaultRequesterCodec,
): QueueSnapshot {
  const load = (entry: SavedEntry): QueueEntry | null => loadEntry(entry, factory, codec);
  const all = (entries: SavedEntry[]): QueueEntry[] =>
    entries.map(load).filter((entry): entry is QueueEntry => entry !== null);
  return {
    current: snapshot.current ? load(snapshot.current) : null,
    upcoming: all(snapshot.upcoming),
    history: all(snapshot.history),
  };
}

/**
 * Checks that a stored value looks like a snapshot.
 *
 * @param value - The stored value.
 * @returns The snapshot, or `null` when it isn't one.
 */
export function readSnapshot(value: JsonValue | null): PlayerSnapshot | null {
  if (!isRecord(value) || value["version"] !== 1 || typeof value["guildId"] !== "string") {
    return null;
  }
  if (typeof value["nodeId"] !== "string" || !Array.isArray(value["upcoming"])) return null;
  return value as unknown as PlayerSnapshot;
}

function saveEntry(entry: QueueEntry, codec: RequesterCodec): SavedEntry {
  const item = entry.item;
  const requester = codec.serialize(item.requester);
  const saved: SavedItem =
    item.kind === "track"
      ? { kind: "track", track: item.toApi() }
      : {
          kind: "unresolved",
          input: definedOnly({
            title: item.title,
            author: item.author,
            durationMs: item.durationMs,
            isrc: item.isrc,
            uri: item.uri,
            artworkUrl: item.artworkUrl,
            source: item.source,
            extra: { ...item.extra },
          }),
        };
  if (requester !== undefined) saved.requester = requester;
  return { id: entry.id, addedAt: entry.addedAt, item: saved };
}

function loadEntry(
  entry: SavedEntry,
  factory: TrackFactory,
  codec: RequesterCodec,
): QueueEntry | null {
  const requester =
    entry.item.requester === undefined ? undefined : codec.deserialize(entry.item.requester);
  if (entry.item.kind === "track" && entry.item.track) {
    return { id: entry.id, addedAt: entry.addedAt, item: factory(entry.item.track, requester) };
  }
  if (entry.item.kind === "unresolved" && entry.item.input) {
    const input: UnresolvedTrackInput = { ...entry.item.input };
    if (requester !== undefined) input.requester = requester;
    return { id: entry.id, addedAt: entry.addedAt, item: UnresolvedTrack.create(input) };
  }
  return null;
}

function definedOnly(input: {
  title: string;
  author: string | null;
  durationMs: number | null;
  isrc: string | null;
  uri: string | null;
  artworkUrl: string | null;
  source: string | null;
  extra: JsonObject;
}): Omit<UnresolvedTrackInput, "requester"> {
  const out: Omit<UnresolvedTrackInput, "requester"> = { title: input.title, extra: input.extra };
  if (input.author !== null) out.author = input.author;
  if (input.durationMs !== null) out.durationMs = input.durationMs;
  if (input.isrc !== null) out.isrc = input.isrc;
  if (input.uri !== null) out.uri = input.uri;
  if (input.artworkUrl !== null) out.artworkUrl = input.artworkUrl;
  if (input.source !== null) out.source = input.source;
  return out;
}
