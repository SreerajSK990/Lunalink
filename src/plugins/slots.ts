import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import type { NodeSelector } from "../node/selection/strategies.js";
import type { PlayerClass } from "../player/PlayerManager.js";
import type { QueueProvider } from "../queue/types.js";
import type { PlayerStore } from "../stores/PlayerStore.js";
import type { TrackFactory } from "../track/toSearchResult.js";
import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";

/**
 * Picks the playable track that best matches an unresolved one.
 *
 * @param wanted - The unresolved track.
 * @param candidates - Search results.
 * @returns The best match, or `undefined`.
 */
export type MirrorMatcher = (
  wanted: UnresolvedTrack,
  candidates: readonly Track[],
) => Track | undefined;

/**
 * What each slot holds.
 */
export interface SlotValues {
  /** Creates each player's queue. */
  queue: QueueProvider;
  /** Where state is saved. */
  store: PlayerStore;
  /** The player class. */
  player: PlayerClass;
  /** Builds tracks. */
  trackFactory: TrackFactory;
  /** Picks nodes. */
  nodeSelector: NodeSelector;
  /** Matches unresolved tracks to playable ones. */
  mirrorMatcher: MirrorMatcher;
}

/**
 * Name of a replaceable part.
 */
export type SlotName = keyof SlotValues;

/**
 * Holds the parts plugins replaced. Each slot has one owner.
 */
export class SlotRegistry {
  readonly #owners = new Map<SlotName, string>();
  readonly #values: Partial<SlotValues> = {};
  readonly #listeners = new Set<(name: SlotName) => void>();

  /**
   * Reserves slots for a plugin.
   *
   * @param owner - Plugin name.
   * @param names - Slots it replaces.
   * @param overrides - Plugins it may take slots from.
   * @throws {LunalinkError} `PLUGIN_CONFLICT` when another plugin owns a slot.
   */
  claim(owner: string, names: readonly SlotName[], overrides: readonly string[] = []): void {
    for (const name of names) {
      const current = this.#owners.get(name);
      if (current !== undefined && current !== owner && !overrides.includes(current)) {
        throw new LunalinkError(
          ErrorCode.PluginConflict,
          `Plugins "${current}" and "${owner}" both replace the ${name} slot. Add "${current}" to the overrides of "${owner}" if that's intended.`,
          { details: { slot: name, plugins: [current, owner] } },
        );
      }
    }
    for (const name of names) this.#owners.set(name, owner);
  }

  /**
   * Fills a slot. The plugin must have claimed it.
   *
   * @param owner - Plugin name.
   * @param name - Slot.
   * @param value - The replacement.
   * @throws {LunalinkError} `PLUGIN_CONFLICT` when the plugin didn't claim the slot.
   */
  set<Name extends SlotName>(owner: string, name: Name, value: SlotValues[Name]): void {
    if (this.#owners.get(name) !== owner) {
      throw new LunalinkError(
        ErrorCode.PluginConflict,
        `Plugin "${owner}" sets the ${name} slot without listing it in its slots.`,
        { details: { slot: name, plugin: owner } },
      );
    }
    this.#values[name] = value;
    for (const listener of this.#listeners) listener(name);
  }

  /**
   * Reads a slot.
   *
   * @param name - Slot.
   * @returns The replacement, or `undefined` when the default is in use.
   */
  get<Name extends SlotName>(name: Name): SlotValues[Name] | undefined {
    return this.#values[name];
  }

  /**
   * Releases every slot a plugin owns. The defaults come back.
   *
   * @param owner - Plugin name.
   */
  release(owner: string): void {
    for (const [name, current] of [...this.#owners]) {
      if (current !== owner) continue;
      this.#owners.delete(name);
      Reflect.deleteProperty(this.#values, name);
      for (const listener of this.#listeners) listener(name);
    }
  }

  /**
   * Listens for slot changes.
   *
   * @param listener - Called with the slot that changed.
   * @returns A function that stops listening.
   */
  onChange(listener: (name: SlotName) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
