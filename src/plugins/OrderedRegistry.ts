/**
 * One registered item and who registered it.
 */
export interface RegistryEntry<T> {
  /** Plugin name, or `user` for items you add yourself. */
  readonly owner: string;
  /** The item. */
  readonly item: T;
  /** Higher runs first. */
  readonly priority: number;
}

/**
 * A list of items ordered by priority, then by registration order. Used for resolvers, hooks,
 * presets, capability rules, event mappers and backends.
 */
export class OrderedRegistry<T> {
  #entries: (RegistryEntry<T> & { order: number })[] = [];
  #counter = 0;

  /**
   * Adds an item.
   *
   * @param owner - Who adds it.
   * @param item - The item.
   * @param priority - Higher runs first. Defaults to 0.
   * @returns A function that removes it again.
   */
  add(owner: string, item: T, priority = 0): () => void {
    const entry = { owner, item, priority, order: this.#counter++ };
    this.#entries.push(entry);
    this.#entries.sort((a, b) => b.priority - a.priority || a.order - b.order);
    return () => {
      this.#entries = this.#entries.filter((other) => other !== entry);
    };
  }

  /**
   * Removes everything one owner added.
   *
   * @param owner - The owner.
   */
  removeOwner(owner: string): void {
    this.#entries = this.#entries.filter((entry) => entry.owner !== owner);
  }

  /**
   * Lists the entries, in run order.
   *
   * @returns The entries.
   */
  entries(): readonly RegistryEntry<T>[] {
    return [...this.#entries];
  }

  /**
   * Lists the items, in run order.
   *
   * @returns The items.
   */
  items(): T[] {
    return this.#entries.map((entry) => entry.item);
  }

  /**
   * Number of entries.
   *
   * @returns The count.
   */
  get size(): number {
    return this.#entries.length;
  }
}
