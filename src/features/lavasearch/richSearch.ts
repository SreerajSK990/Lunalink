import type { Node } from "../../node/Node.js";
import type {
  ApiLavaSearchResult,
  ApiLavaSearchType,
  ApiPlaylist,
  JsonObject,
} from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { Requester } from "../../track/Register.js";
import type { TrackFactory } from "../../track/toSearchResult.js";
import type { Track } from "../../track/Track.js";

/**
 * An album, artist or playlist from a rich search.
 */
export interface RichSearchCollection {
  /** Name. */
  name: string;
  /** Extra data from the source plugin, such as artwork and links. */
  pluginInfo: Readonly<JsonObject>;
  /** Tracks, when the source included them. */
  tracks: Track[];
}

/**
 * Result of {@link richSearch}.
 */
export interface RichSearchResult {
  /** Matching tracks. */
  tracks: Track[];
  /** Matching albums. */
  albums: RichSearchCollection[];
  /** Matching artists. */
  artists: RichSearchCollection[];
  /** Matching playlists. */
  playlists: RichSearchCollection[];
  /** Text suggestions. */
  texts: { text: string; plugin: Readonly<JsonObject> }[];
  /** Extra data from the source plugin. */
  plugin: Readonly<JsonObject>;
}

/**
 * Searches tracks, albums, artists, playlists and text suggestions at once with the LavaSearch
 * plugin (`GET /v4/loadsearch`).
 *
 * @param node - A node with LavaSearch.
 * @param query - The search, with a prefix such as `spsearch:` to pick the source.
 * @param types - Result types to ask for. Defaults to all.
 * @param requester - Requester to put on tracks.
 * @param factory - Builds the tracks.
 * @returns The results, or `null` when nothing matched.
 * @throws {UnsupportedFeatureError} Without LavaSearch.
 */
export async function richSearch(
  node: Node,
  query: string,
  types: readonly ApiLavaSearchType[],
  requester: Requester | undefined,
  factory: TrackFactory,
): Promise<RichSearchResult | null> {
  node.capabilities.require(
    "search:lavasearch",
    "Rich search needs the LavaSearch plugin on Lavalink.",
  );
  const body = await node.rest.request<ApiLavaSearchResult | undefined>(
    "GET",
    Routes.lavaSearch(),
    {
      query: { query, types: types.length > 0 ? types.join(",") : undefined },
    },
  );
  if (!body) return null;
  const collection = (playlist: ApiPlaylist): RichSearchCollection => ({
    name: playlist.info.name,
    pluginInfo: playlist.pluginInfo,
    tracks: playlist.tracks.map((track) => factory(track, requester)),
  });
  return {
    tracks: body.tracks.map((track) => factory(track, requester)),
    albums: body.albums.map(collection),
    artists: body.artists.map(collection),
    playlists: body.playlists.map(collection),
    texts: body.texts,
    plugin: body.plugin,
  };
}
