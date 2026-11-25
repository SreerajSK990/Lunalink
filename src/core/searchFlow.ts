import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import type { Node } from "../node/Node.js";
import type { Hooks } from "../plugins/hooks.js";
import type { PluginResolution } from "../plugins/runResolvers.js";
import type { ResolvedItem, SearchInput } from "../plugins/resolvers.js";
import type { MirrorMatcher } from "../plugins/slots.js";
import { buildIdentifier } from "../search/buildIdentifier.js";
import type { LinkRules } from "../search/linkRules.js";
import { mirrorQueries } from "../search/mirror.js";
import type { SearchPlatformName } from "../search/platforms.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { Requester } from "../track/Register.js";
import type { SearchResult } from "../track/SearchResult.js";
import { toSearchResult, type TrackFactory } from "../track/toSearchResult.js";
import { Track } from "../track/Track.js";
import { UnresolvedTrack } from "../track/UnresolvedTrack.js";

/**
 * What the search flow needs from the Lunalink instance.
 */
export interface SearchHost {
  /** Hooks. */
  hooks: Hooks;
  /**
   * Runs plugin resolvers.
   *
   * @param input - Search input.
   * @returns A resolver result, or `null`.
   */
  resolvePlugins(input: SearchInput): Promise<PluginResolution | null>;
  /**
   * Picks the node for a search.
   *
   * @param nodeId - Node asked for, if any.
   * @returns The node.
   */
  searchNode(nodeId: string | undefined): Node;
  /** Builds tracks. */
  trackFactory(): TrackFactory;
  /** Default search platform. */
  defaultSource: SearchPlatformName;
  /** Link rules. */
  linkRules: LinkRules;
}

/**
 * Runs a search: `beforeSearch` hooks, plugin resolvers, then the node, then `afterSearch`.
 *
 * @param host - Hooks, resolvers and nodes.
 * @param input - What to search for.
 * @returns The result.
 */
export async function runSearch(
  host: SearchHost,
  input: SearchInput,
): Promise<SearchResult<QueueItem>> {
  const before = await host.hooks.beforeSearch(input);
  if ("tracks" in before) return host.hooks.afterSearch(before, input);
  const resolution = await host.resolvePlugins(before);
  const result = resolution
    ? await fromResolution(host, resolution, before)
    : await fromNode(host, before);
  return host.hooks.afterSearch(result, before);
}

async function fromNode(host: SearchHost, input: SearchInput): Promise<SearchResult<QueueItem>> {
  const node = host.searchNode(input.nodeId);
  const identifier = buildIdentifier(input.query, {
    source: input.source,
    defaultSource: host.defaultSource,
    linkRules: host.linkRules,
    capabilities: node.info ? node.capabilities : null,
    nodeId: node.id,
  });
  const loaded = await node.rest.loadTracks(identifier);
  return toSearchResult(loaded, node.id, input.requester, host.trackFactory());
}

async function fromResolution(
  host: SearchHost,
  resolution: PluginResolution,
  input: SearchInput,
): Promise<SearchResult<QueueItem>> {
  const tracks: QueueItem[] = [];
  for (const item of resolution.result.items) {
    tracks.push(...(await toItems(host, item, input)));
  }
  const type =
    resolution.result.type === "empty" || tracks.length === 0 ? "empty" : resolution.result.type;
  return {
    type,
    tracks,
    playlist:
      type === "playlist"
        ? { name: resolution.result.playlistName ?? "", selectedTrack: -1, pluginInfo: {} }
        : null,
    error: null,
    nodeId: null,
  };
}

async function toItems(
  host: SearchHost,
  item: ResolvedItem,
  input: SearchInput,
): Promise<QueueItem[]> {
  const requester: Requester | undefined = input.requester;
  if (item instanceof UnresolvedTrack)
    return [item.requester === undefined ? item.withRequester(requester) : item];
  if (item instanceof Track)
    return [item.requester === undefined ? item.withRequester(requester) : item];
  if ("identifier" in item) {
    const node = host.searchNode(input.nodeId);
    const loaded = toSearchResult(
      await node.rest.loadTracks(item.identifier),
      node.id,
      requester,
      host.trackFactory(),
    );
    return loaded.type === "search" ? loaded.tracks.slice(0, 1) : loaded.tracks;
  }
  return [
    host.trackFactory()(
      { encoded: item.encoded, info: item.info, pluginInfo: {}, userData: {} },
      requester,
    ),
  ];
}

/**
 * Finds a playable copy of an unresolved track on a node: an ISRC search, then a title and
 * author search, scored by the matcher.
 *
 * @param node - Node to search on.
 * @param item - The unresolved track.
 * @param matcher - Picks the best candidate.
 * @returns A playable track that keeps the original's display metadata.
 * @throws {LunalinkError} `TRACK_LOAD_FAILED` when nothing matches.
 */
export async function mirrorTrack(
  node: Node,
  item: UnresolvedTrack,
  matcher: MirrorMatcher,
): Promise<Track> {
  for (const query of mirrorQueries(item)) {
    const result = toSearchResult(await node.rest.loadTracks(query), node.id, item.requester);
    const best = matcher(item, result.tracks);
    if (best) return new Track(best.toApi(), item.requester, item);
  }
  throw new LunalinkError(
    ErrorCode.TrackLoadFailed,
    `No playable match for "${item.searchText()}".`,
    {
      details: { title: item.title, author: item.author, nodeId: node.id },
    },
  );
}
