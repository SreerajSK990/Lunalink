import type { ApiLoadResult, ApiTrack } from "../protocol/index.js";
import type { Requester } from "./Register.js";
import type { SearchResult } from "./SearchResult.js";
import { Track } from "./Track.js";

/**
 * Builds a {@link Track} from the node's format. Swap it through `structures.trackFactory`
 * to return your own `Track` subclass.
 *
 * @param api - Track as the node sent it.
 * @param requester - Who asked for it.
 * @returns The track.
 */
export type TrackFactory = (api: ApiTrack, requester: Requester | undefined) => Track;

/**
 * The default track factory.
 *
 * @param api - Track as the node sent it.
 * @param requester - Who asked for it.
 * @returns A plain {@link Track}.
 */
export const defaultTrackFactory: TrackFactory = (api, requester) => new Track(api, requester);

/**
 * Turns a `/v4/loadtracks` response into a {@link SearchResult}.
 *
 * @param result - The node's response.
 * @param nodeId - Node that answered.
 * @param requester - Requester to put on every track.
 * @param factory - Builds the tracks.
 * @returns The search result.
 */
export function toSearchResult(
  result: ApiLoadResult,
  nodeId: string,
  requester: Requester | undefined,
  factory: TrackFactory = defaultTrackFactory,
): SearchResult {
  const base = { playlist: null, error: null, nodeId };
  switch (result.loadType) {
    case "track":
      return { ...base, type: "track", tracks: [factory(result.data, requester)] };
    case "search":
      return {
        ...base,
        type: "search",
        tracks: result.data.map((track) => factory(track, requester)),
      };
    case "playlist":
      return {
        ...base,
        type: "playlist",
        tracks: result.data.tracks.map((track) => factory(track, requester)),
        playlist: {
          name: result.data.info.name,
          selectedTrack: result.data.info.selectedTrack,
          pluginInfo: result.data.pluginInfo,
        },
      };
    case "error":
      return { ...base, type: "error", tracks: [], error: result.data };
    default:
      return { ...base, type: "empty", tracks: [] };
  }
}
