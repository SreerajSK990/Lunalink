import type { CapabilitySet } from "../capabilities/CapabilitySet.js";
import { UnsupportedFeatureError } from "../errors/UnsupportedFeatureError.js";
import { ValidationError } from "../errors/ValidationError.js";
import type { ApiFilters } from "../protocol/index.js";
import { builtInPresets } from "./presets.js";
import type { FilterName, FilterPreset, FilterState } from "./types.js";
import { validateFilters } from "./validateFilters.js";

/**
 * What a filter manager needs from its player.
 */
export interface FilterManagerHost {
  /** Capabilities of the player's current node, or `null` before it has one. */
  capabilities(): CapabilitySet | null;
  /** Id of the player's current node, for error messages. */
  nodeId(): string;
  /**
   * Sends the complete filter state to the node.
   *
   * @param filters - Every active filter.
   */
  send(filters: ApiFilters): Promise<void>;
  /** Presets registered by plugins. */
  extraPresets(): readonly FilterPreset[];
}

/**
 * Filters for one player, available as `player.filters`.
 *
 * Lavalink replaces every filter on each update, so this class keeps the full state and always
 * sends all of it. You change only what you want; the rest stays as it was.
 *
 * @example
 * ```ts
 * await player.filters.preset("nightcore");
 * await player.filters.set({ rotation: { rotationHz: 0.2 } });
 * await player.filters.clear("rotation");
 * await player.filters.clear();
 * ```
 */
export class FilterManager {
  readonly #host: FilterManagerHost;
  #state: FilterState = {};

  /**
   * Creates the manager.
   *
   * @param host - The owning player.
   */
  constructor(host: FilterManagerHost) {
    this.#host = host;
  }

  /**
   * Current filters.
   *
   * @returns A copy of the active filters.
   */
  get state(): Readonly<FilterState> {
    return structuredClone(this.#state);
  }

  /**
   * Names of the filters that are on.
   *
   * @returns Filter names, plus plugin filter names.
   */
  active(): string[] {
    const names = Object.keys(this.#state).filter((key) => key !== "pluginFilters");
    return [...names, ...Object.keys(this.#state.pluginFilters ?? {})];
  }

  /**
   * Changes some filters and keeps the rest. Set a filter to `null` to turn it off.
   *
   * @param patch - Filters to change.
   * @throws {ValidationError} When a value is out of range.
   * @throws {UnsupportedFeatureError} When the node doesn't have one of the filters.
   */
  async set(patch: Partial<FilterState>): Promise<void> {
    await this.#apply(mergeFilters(this.#state, patch));
  }

  /**
   * Replaces every filter.
   *
   * @param filters - The new filter state.
   */
  async replace(filters: FilterState): Promise<void> {
    await this.#apply(mergeFilters({}, filters));
  }

  /**
   * Turns filters off. With no names it turns everything off.
   *
   * @param names - Filters to turn off. Plugin filter names work too.
   */
  async clear(...names: string[]): Promise<void> {
    if (names.length === 0) {
      await this.#apply({});
      return;
    }
    const removed = new Set(names);
    const plugin = withoutKeys(this.#state.pluginFilters ?? {}, removed);
    const core = withoutKeys(this.#state, new Set([...names, "pluginFilters"]));
    const next = Object.keys(plugin).length > 0 ? { ...core, pluginFilters: plugin } : core;
    await this.#apply(structuredClone(next));
  }

  /**
   * Lists every preset: the built-in ones and those added by plugins.
   *
   * @returns The presets.
   */
  presets(): FilterPreset[] {
    return [...builtInPresets, ...this.#host.extraPresets()];
  }

  /**
   * Applies a preset on top of the current filters.
   *
   * @param name - Preset name, for example `nightcore`.
   * @throws {ValidationError} When there's no preset with that name.
   */
  async preset(name: string): Promise<void> {
    await this.set(this.#findPreset(name).filters);
  }

  /**
   * Checks whether a preset's filters are all active with the preset's values.
   *
   * @param name - Preset name.
   * @returns `true` when the preset is on.
   */
  isPresetActive(name: string): boolean {
    const preset = this.#findPreset(name);
    return Object.entries(preset.filters).every(
      ([key, value]) =>
        JSON.stringify((this.#state as Record<string, unknown>)[key]) === JSON.stringify(value),
    );
  }

  /**
   * Turns a preset on, or off when it's already on.
   *
   * @param name - Preset name.
   * @returns `true` when the preset is now on.
   */
  async toggle(name: string): Promise<boolean> {
    const preset = this.#findPreset(name);
    if (this.isPresetActive(name)) {
      await this.clear(...Object.keys(preset.filters));
      return false;
    }
    await this.set(preset.filters);
    return true;
  }

  /**
   * Sets equalizer bands, keeping bands you don't mention.
   *
   * @param bands - Bands to set.
   */
  async setEqualizer(bands: readonly { band: number; gain: number }[]): Promise<void> {
    const merged = new Map((this.#state.equalizer ?? []).map((band) => [band.band, band.gain]));
    for (const band of bands) merged.set(band.band, band.gain);
    const equalizer = [...merged]
      .map(([band, gain]) => ({ band, gain }))
      .sort((a, b) => a.band - b.band);
    await this.set({ equalizer });
  }

  /**
   * Re-sends the current filters, for example after the player moved to another node.
   */
  async reapply(): Promise<void> {
    await this.#host.send(toWire(this.#state));
  }

  /**
   * Replaces the stored state without sending anything. Used when restoring a player.
   *
   * @param filters - State to keep.
   */
  load(filters: FilterState): void {
    this.#state = structuredClone(filters);
  }

  async #apply(next: FilterState): Promise<void> {
    validateFilters(next);
    this.#requireSupport(next);
    await this.#host.send(toWire(next));
    this.#state = next;
  }

  #requireSupport(filters: FilterState): void {
    const capabilities = this.#host.capabilities();
    if (!capabilities) return;
    const names = [
      ...Object.keys(filters).filter((key) => key !== "pluginFilters"),
      ...Object.keys(filters.pluginFilters ?? {}),
    ];
    const supported = new Set(
      capabilities
        .list()
        .filter((capability) => capability.startsWith("filter:"))
        .map((capability) => capability.slice("filter:".length).toLowerCase()),
    );
    for (const name of names) {
      if (!supported.has(name.toLowerCase())) {
        throw new UnsupportedFeatureError(
          `filter:${name}`,
          this.#host.nodeId(),
          "The node doesn't list this filter in /v4/info. It may be disabled, or need NodeLink or a plugin.",
        );
      }
    }
  }

  #findPreset(name: string): FilterPreset {
    const preset = this.presets().find(
      (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
    );
    if (!preset) {
      throw new ValidationError(
        "preset",
        `no preset called "${name}". Try one of: ${this.presets()
          .map((p) => p.name)
          .join(", ")}`,
      );
    }
    return preset;
  }
}

function withoutKeys(source: object, keys: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.has(key)));
}

function mergeEntries(base: object, patch: object): Record<string, unknown> {
  const merged = new Map<string, unknown>(Object.entries(base));
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) merged.delete(key);
    else merged.set(key, value);
  }
  return Object.fromEntries(merged);
}

function mergeFilters(base: FilterState, patch: Partial<FilterState>): FilterState {
  const { pluginFilters: patchPlugins, ...patchCore } = patch;
  const { pluginFilters: basePlugins, ...baseCore } = base;
  const core = mergeEntries(baseCore, patchCore);
  const plugins = mergeEntries(basePlugins ?? {}, patchPlugins ?? {});
  const next = Object.keys(plugins).length > 0 ? { ...core, pluginFilters: plugins } : core;
  return structuredClone(next);
}

function toWire(state: FilterState): ApiFilters {
  return structuredClone(state);
}

/**
 * Every filter name a {@link FilterState} can hold, for help commands and validation.
 */
export const filterNames: readonly FilterName[] = [
  "volume",
  "equalizer",
  "karaoke",
  "timescale",
  "tremolo",
  "vibrato",
  "rotation",
  "distortion",
  "channelMix",
  "lowPass",
  "highPass",
  "echo",
  "reverb",
  "chorus",
  "flanger",
  "phaser",
  "spatial",
  "compressor",
  "phonograph",
  "tesseract",
];
