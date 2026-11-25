import { ValidationError } from "../errors/ValidationError.js";
import type { ApiTrackInfo } from "../protocol/index.js";
import type { SearchPlatformName } from "../search/index.js";
import type { Requester } from "../track/Register.js";
import { Track } from "../track/Track.js";
import { UnresolvedTrack } from "../track/UnresolvedTrack.js";
import { isRecord } from "../utils/guards.js";

/**
 * What a search asks for.
 */
export interface SearchInput {
  /** Text or a link. */
  query: string;
  /** Platform to search on, for text queries. */
  source?: SearchPlatformName;
  /** Who asked. Put on every returned track. */
  requester?: Requester;
  /** Node to search on. Defaults to the best ready node. */
  nodeId?: string;
}

/**
 * What a resolver gets besides the query.
 */
export interface ResolveContext {
  /** The whole search input. */
  input: SearchInput;
  /** Aborts when the call times out or the plugin is removed. */
  signal: AbortSignal;
}

/**
 * One item a resolver returns:
 *
 * - an `UnresolvedTrack`: metadata only; the mirror finds a playable match before it plays.
 * - a `Track`: already playable.
 * - `{ identifier }`: something the node can load, such as a direct audio link.
 * - `{ encoded, info }`: a playable track in the node's format.
 */
export type ResolvedItem =
  UnresolvedTrack | Track | { identifier: string } | { encoded: string; info: ApiTrackInfo };

/**
 * What a resolver returns.
 */
export interface ResolveResult {
  /** Kind of result, as for node results. */
  type: "track" | "playlist" | "search" | "empty";
  /** The items. */
  items: ResolvedItem[];
  /** Playlist name, for playlist results. */
  playlistName?: string;
}

/**
 * Turns queries into tracks on the client side, before the node is asked. For example, a
 * resolver can turn Spotify links into unresolved tracks without LavaSrc on the server.
 */
export interface Resolver {
  /** Name shown in `plugins.explain()`. */
  readonly name: string;
  /** Higher runs first. Defaults to 0. */
  readonly priority?: number;
  /** Keep asking later resolvers and the node when this one returns nothing. Defaults to `true`. */
  readonly fallthrough?: boolean;
  /**
   * Says whether this resolver handles a query.
   *
   * @param query - The query.
   * @returns `true` to handle it.
   */
  match(query: string): boolean;
  /**
   * Resolves the query.
   *
   * @param query - The query.
   * @param context - Search input and abort signal.
   * @returns The result.
   */
  resolve(query: string, context: ResolveContext): ResolveResult | Promise<ResolveResult>;
}

/**
 * Checks a resolver's output and names the plugin and field when something is wrong.
 *
 * @param owner - Plugin name.
 * @param resolver - Resolver name.
 * @param result - What it returned.
 * @returns The result, checked.
 * @throws {ValidationError} When the shape is wrong.
 */
export function validateResolveResult(
  owner: string,
  resolver: string,
  result: unknown,
): ResolveResult {
  const where = `${owner}/${resolver}`;
  if (!isRecord(result) || !Array.isArray(result["items"])) {
    throw new ValidationError(where, "must return { type, items }");
  }
  const type = result["type"];
  if (type !== "track" && type !== "playlist" && type !== "search" && type !== "empty") {
    throw new ValidationError(`${where}: type`, "must be track, playlist, search or empty");
  }
  (result["items"] as unknown[]).forEach((item, index) => {
    if (item instanceof Track || item instanceof UnresolvedTrack) {
      if (item instanceof UnresolvedTrack && !item.title) {
        throw new ValidationError(`${where}: items[${String(index)}]`, "missing title");
      }
      return;
    }
    if (isRecord(item) && typeof item["identifier"] === "string") return;
    if (isRecord(item) && typeof item["encoded"] === "string" && isRecord(item["info"])) return;
    throw new ValidationError(
      `${where}: items[${String(index)}]`,
      "must be a Track, an UnresolvedTrack, { identifier } or { encoded, info }",
    );
  });
  return result as unknown as ResolveResult;
}
