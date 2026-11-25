import { isolate, isolateSync, type IsolateOptions, type PluginErrorHandler } from "./isolate.js";
import type { OrderedRegistry } from "./OrderedRegistry.js";
import {
  type ResolveResult,
  type Resolver,
  type SearchInput,
  validateResolveResult,
} from "./resolvers.js";

/**
 * The resolver that answered and what it returned.
 */
export interface PluginResolution {
  /** Plugin that owns the resolver. */
  owner: string;
  /** Resolver name. */
  resolver: string;
  /** The result. */
  result: ResolveResult;
}

/**
 * What `plugins.explain()` returns.
 */
export interface QueryExplanation {
  /** The query. */
  query: string;
  /** Resolver that would run first, or `null` when the node handles it. */
  handledBy: { owner: string; resolver: string } | null;
  /** Every resolver, in run order, and whether it matches. */
  candidates: { owner: string; resolver: string; priority: number; matches: boolean }[];
}

/**
 * Runs matching resolvers in priority order. A resolver that throws, times out or returns
 * nothing passes the query on, unless it set `fallthrough: false`.
 *
 * @param registry - The resolvers.
 * @param input - Search input.
 * @param options - Timeout and error handler.
 * @returns The first non-empty result, or `null` to ask the node.
 */
export async function runResolvers(
  registry: OrderedRegistry<Resolver>,
  input: SearchInput,
  options: Omit<IsolateOptions<null>, "fallback">,
): Promise<PluginResolution | null> {
  for (const { owner, item: resolver } of registry.entries()) {
    const matches = isolateSync(
      owner,
      `${resolver.name}.match`,
      () => resolver.match(input.query),
      false,
      options.onError,
    );
    if (!matches) continue;
    const result = await isolate(
      owner,
      `${resolver.name}.resolve`,
      async (signal) =>
        validateResolveResult(
          owner,
          resolver.name,
          await resolver.resolve(input.query, { input, signal }),
        ),
      { timeoutMs: options.timeoutMs, fallback: null, onError: options.onError },
    );
    if (result && result.items.length > 0) return { owner, resolver: resolver.name, result };
    if (resolver.fallthrough === false) {
      return { owner, resolver: resolver.name, result: result ?? { type: "empty", items: [] } };
    }
  }
  return null;
}

/**
 * Explains which resolver handles a query.
 *
 * @param registry - The resolvers.
 * @param query - The query.
 * @param onError - Reports a throwing `match`.
 * @returns The explanation.
 */
export function explainQuery(
  registry: OrderedRegistry<Resolver>,
  query: string,
  onError: PluginErrorHandler,
): QueryExplanation {
  const candidates = registry.entries().map(({ owner, item, priority }) => ({
    owner,
    resolver: item.name,
    priority,
    matches: isolateSync(owner, `${item.name}.match`, () => item.match(query), false, onError),
  }));
  const first = candidates.find((candidate) => candidate.matches);
  return {
    query,
    handledBy: first ? { owner: first.owner, resolver: first.resolver } : null,
    candidates,
  };
}
