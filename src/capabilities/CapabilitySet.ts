import { UnsupportedFeatureError } from "../errors/UnsupportedFeatureError.js";
import type { Capability } from "./Capability.js";

/**
 * An immutable set of capabilities belonging to one node.
 *
 * @example
 * ```ts
 * if (node.capabilities.has("lyrics")) { ... }
 * node.capabilities.require("search:lavasearch", "Install the LavaSearch plugin.");
 * ```
 */
export class CapabilitySet {
  readonly #items: ReadonlySet<string>;
  readonly #nodeId: string;

  /**
   * Creates a set.
   *
   * @param nodeId - Owning node, used in error messages.
   * @param items - Capabilities.
   */
  constructor(nodeId: string, items: Iterable<Capability> = []) {
    this.#nodeId = nodeId;
    this.#items = new Set(items);
  }

  /**
   * Number of capabilities.
   *
   * @returns Size of the set.
   */
  get size(): number {
    return this.#items.size;
  }

  /**
   * Checks for a capability.
   *
   * @param capability - Capability to look for.
   * @returns `true` when present.
   */
  has(capability: Capability): boolean {
    return this.#items.has(capability);
  }

  /**
   * Checks that at least one of several capabilities is present.
   *
   * @param capabilities - Capabilities to look for.
   * @returns The first one found, or `undefined`.
   */
  firstOf(...capabilities: Capability[]): Capability | undefined {
    return capabilities.find((capability) => this.#items.has(capability));
  }

  /**
   * Throws unless a capability is present.
   *
   * @param capability - Required capability.
   * @param hint - What the user can do about it.
   * @throws {UnsupportedFeatureError} When it's missing.
   */
  require(capability: Capability, hint?: string): void {
    if (!this.#items.has(capability)) {
      throw new UnsupportedFeatureError(capability, this.#nodeId, hint);
    }
  }

  /**
   * Returns a new set with extra capabilities added.
   *
   * @param capabilities - Capabilities to add.
   * @returns A new set. This one is unchanged.
   */
  with(capabilities: Iterable<Capability>): CapabilitySet {
    return new CapabilitySet(this.#nodeId, [...this.#items, ...capabilities]);
  }

  /**
   * Lists every capability, sorted.
   *
   * @returns Capability strings.
   */
  list(): string[] {
    return [...this.#items].sort();
  }
}
