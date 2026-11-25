import type { Player } from "../player/Player.js";
import type { TrackEndReason } from "../drivers/types.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { SearchResult } from "../track/SearchResult.js";
import type { Track } from "../track/Track.js";
import { isolate, isolateSync, type PluginErrorHandler } from "./isolate.js";
import { OrderedRegistry } from "./OrderedRegistry.js";
import type { SearchInput } from "./resolvers.js";

/**
 * Middleware a plugin can add. Each hook may return nothing to leave things unchanged.
 */
export interface HookMap {
  /**
   * Runs before a search. Return a changed input, or a result to skip the search.
   *
   * @param input - The search input.
   * @returns A changed input, a result, or nothing.
   */
  beforeSearch(
    input: SearchInput,
  ):
    | SearchInput
    | SearchResult<QueueItem>
    | undefined
    | Promise<SearchInput | SearchResult<QueueItem> | undefined>;
  /**
   * Runs after a search. Return a changed result.
   *
   * @param result - The result.
   * @param input - The search input.
   * @returns A changed result, or nothing.
   */
  afterSearch(
    result: SearchResult<QueueItem>,
    input: SearchInput,
  ): SearchResult<QueueItem> | undefined | Promise<SearchResult<QueueItem> | undefined>;
  /**
   * Runs right before a track plays. Return another track, or `null` to skip it.
   *
   * @param player - The player.
   * @param track - The track.
   * @returns A track, `null`, or nothing.
   */
  beforePlay(
    player: Player,
    track: Track,
  ): Track | null | undefined | Promise<Track | null | undefined>;
  /**
   * Runs after a track ended.
   *
   * @param player - The player.
   * @param track - The track.
   * @param reason - Why it ended.
   */
  afterTrackEnd(
    player: Player,
    track: Track,
    reason: TrackEndReason,
  ): undefined | Promise<undefined>;
  /**
   * Runs before items are added to a queue. Synchronous, so the built-in queue stays
   * synchronous. Return the items to add.
   *
   * @param player - The player.
   * @param items - The items.
   * @returns The items to add, or nothing.
   */
  beforeQueueAdd(player: Player, items: readonly QueueItem[]): readonly QueueItem[] | undefined;
}

/**
 * Name of a hook.
 */
export type HookName = keyof HookMap;

/**
 * Holds and runs every hook, each isolated from the others.
 */
export class Hooks {
  readonly #registries: { [Name in HookName]: OrderedRegistry<HookMap[Name]> } = {
    beforeSearch: new OrderedRegistry(),
    afterSearch: new OrderedRegistry(),
    beforePlay: new OrderedRegistry(),
    afterTrackEnd: new OrderedRegistry(),
    beforeQueueAdd: new OrderedRegistry(),
  };
  readonly #onError: PluginErrorHandler;
  readonly #timeoutMs: number;

  /**
   * Creates the hook runner.
   *
   * @param onError - Reports failing hooks.
   * @param timeoutMs - How long an async hook may take.
   */
  constructor(onError: PluginErrorHandler, timeoutMs: number) {
    this.#onError = onError;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * Adds a hook.
   *
   * @param owner - Plugin name.
   * @param name - Hook name.
   * @param hook - The hook.
   * @param priority - Higher runs first.
   * @returns A function that removes it.
   */
  add<Name extends HookName>(
    owner: string,
    name: Name,
    hook: HookMap[Name],
    priority = 0,
  ): () => void {
    return this.#registries[name].add(owner, hook, priority);
  }

  /**
   * Removes every hook a plugin added.
   *
   * @param owner - Plugin name.
   */
  removeOwner(owner: string): void {
    for (const registry of Object.values(this.#registries)) registry.removeOwner(owner);
  }

  /**
   * Runs `beforeSearch` hooks.
   *
   * @param input - The search input.
   * @returns The final input, or a result that skips the search.
   */
  async beforeSearch(input: SearchInput): Promise<SearchInput | SearchResult<QueueItem>> {
    let current = input;
    for (const { owner, item } of this.#registries.beforeSearch.entries()) {
      const out = await this.#run(owner, "beforeSearch", () => item(current));
      if (!out) continue;
      if ("tracks" in out) return out;
      current = out;
    }
    return current;
  }

  /**
   * Runs `afterSearch` hooks.
   *
   * @param result - The result.
   * @param input - The search input.
   * @returns The final result.
   */
  async afterSearch(
    result: SearchResult<QueueItem>,
    input: SearchInput,
  ): Promise<SearchResult<QueueItem>> {
    let current = result;
    for (const { owner, item } of this.#registries.afterSearch.entries()) {
      current = (await this.#run(owner, "afterSearch", () => item(current, input))) ?? current;
    }
    return current;
  }

  /**
   * Runs `beforePlay` hooks.
   *
   * @param player - The player.
   * @param track - The track.
   * @returns The track to play, or `null` to skip it.
   */
  async beforePlay(player: Player, track: Track): Promise<Track | null> {
    let current = track;
    for (const { owner, item } of this.#registries.beforePlay.entries()) {
      const out = await this.#run(owner, "beforePlay", () => item(player, current));
      if (out === null) return null;
      if (out) current = out;
    }
    return current;
  }

  /**
   * Runs `afterTrackEnd` hooks.
   *
   * @param player - The player.
   * @param track - The track.
   * @param reason - Why it ended.
   */
  async afterTrackEnd(player: Player, track: Track, reason: TrackEndReason): Promise<void> {
    for (const { owner, item } of this.#registries.afterTrackEnd.entries()) {
      await this.#run(owner, "afterTrackEnd", () => item(player, track, reason));
    }
  }

  /**
   * Runs `beforeQueueAdd` hooks.
   *
   * @param player - The player.
   * @param items - The items.
   * @returns The items to add.
   */
  beforeQueueAdd(player: Player, items: readonly QueueItem[]): readonly QueueItem[] {
    let current = items;
    for (const { owner, item } of this.#registries.beforeQueueAdd.entries()) {
      current =
        isolateSync(
          owner,
          "beforeQueueAdd",
          () => item(player, current),
          undefined,
          this.#onError,
        ) ?? current;
    }
    return current;
  }

  #run<T>(owner: string, label: string, task: () => T | Promise<T>): Promise<T | undefined> {
    return isolate(owner, label, task, {
      timeoutMs: this.#timeoutMs,
      fallback: undefined,
      onError: this.#onError,
    });
  }
}
