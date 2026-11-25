import type { CapabilityRule } from "../capabilities/CapabilityRule.js";
import type { DebugEvent } from "../events/DebugEvent.js";
import type { Listener } from "../events/TypedEmitter.js";
import type { FilterPreset } from "../filters/types.js";
import type { AutoplayStrategy } from "../lifecycle/autoplayStrategies.js";
import type { Node } from "../node/Node.js";
import type { Player } from "../player/Player.js";
import type { JsonValue } from "../protocol/index.js";
import type { PlayerStore } from "../stores/PlayerStore.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { SearchResult } from "../track/SearchResult.js";
import type { Track } from "../track/Track.js";
import type { TimerRegistry } from "../utils/TimerRegistry.js";
import type { PlaybackBackend } from "./backends.js";
import type { EventInterceptor, EventMapper, LunalinkEvents } from "./events.js";
import type { HookMap, HookName } from "./hooks.js";
import type { Resolver, SearchInput } from "./resolvers.js";
import type { SlotName, SlotValues } from "./slots.js";

/**
 * Ordering for hooks and interceptors.
 */
export interface PriorityOptions {
  /** Higher runs first. Defaults to 0. */
  priority?: number;
}

/**
 * What the Lunalink instance offers plugins. The core implements it.
 */
export interface PluginServices {
  /**
   * Searches, with plugin resolvers first.
   *
   * @param input - Search input.
   * @returns The result.
   */
  search(input: SearchInput): Promise<SearchResult<QueueItem>>;
  /**
   * Gets a guild's player.
   *
   * @param guildId - Guild id.
   * @returns The player, or `undefined`.
   */
  getPlayer(guildId: string): Player | undefined;
  /**
   * Lists every player.
   *
   * @returns Players.
   */
  listPlayers(): Player[];
  /**
   * Lists every node.
   *
   * @returns Nodes.
   */
  listNodes(): Node[];
  /**
   * Listens to a Lunalink event.
   *
   * @param name - Event name.
   * @param listener - Listener.
   * @returns A function that stops listening.
   */
  on<Name extends keyof LunalinkEvents>(
    name: Name,
    listener: Listener<LunalinkEvents[Name]>,
  ): () => void;
  /**
   * Emits a plugin event.
   *
   * @param name - Event name.
   * @param args - Arguments.
   */
  emitCustom(name: `${string}:${string}`, args: unknown[]): void;
  /**
   * Adds an autoplay strategy.
   *
   * @param strategy - The strategy.
   * @param position - Before or after the others.
   * @returns A function that removes it.
   */
  addAutoplayStrategy(strategy: AutoplayStrategy, position: "first" | "last"): () => void;
  /**
   * Returns the store in use.
   *
   * @returns The store.
   */
  store(): PlayerStore;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

/**
 * A plugin's own logger. Messages go to the `debug` event with the scope `plugin:<name>`.
 */
export interface PluginLogger {
  /**
   * Logs a detail.
   *
   * @param message - Message.
   * @param data - Extra values.
   */
  trace(message: string, data?: Record<string, unknown>): void;
  /**
   * Logs something worth knowing.
   *
   * @param message - Message.
   * @param data - Extra values.
   */
  info(message: string, data?: Record<string, unknown>): void;
  /**
   * Logs a problem that was handled.
   *
   * @param message - Message.
   * @param data - Extra values.
   */
  warn(message: string, data?: Record<string, unknown>): void;
  /**
   * Logs a failure.
   *
   * @param message - Message.
   * @param data - Extra values.
   */
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Key-value storage namespaced to one plugin, backed by the configured store.
 */
export interface PluginStorage {
  /**
   * Reads a value.
   *
   * @param key - Key.
   * @returns The value, or `null`.
   */
  get(key: string): Promise<JsonValue | null>;
  /**
   * Writes a value.
   *
   * @param key - Key.
   * @param value - Value.
   */
  set(key: string, value: JsonValue): Promise<void>;
  /**
   * Removes a value.
   *
   * @param key - Key.
   */
  delete(key: string): Promise<void>;
  /**
   * Lists this plugin's keys.
   *
   * @returns Keys, without the namespace.
   */
  keys(): Promise<string[]>;
}

/**
 * Per-track data namespaced to one plugin. It lives in the track's `userData`, so it survives
 * persistence and resume.
 */
export interface PluginTrackData {
  /**
   * Reads this plugin's data on a track.
   *
   * @param track - The track.
   * @returns The data, or `undefined`.
   */
  get(track: Track): JsonValue | undefined;
  /**
   * Returns a copy of the track with this plugin's data set.
   *
   * @param track - The track.
   * @param value - The data.
   * @returns The new track.
   */
  with(track: Track, value: JsonValue): Track;
}

/**
 * Everything a plugin can do. Everything registered here is removed when the plugin is torn
 * down.
 */
export interface PluginContext {
  /** The plugin's name. */
  readonly name: string;
  /** Plugin API version of this Lunalink build. */
  readonly apiVersion: number;
  /** Search, players and nodes. */
  readonly lunalink: Pick<PluginServices, "search" | "getPlayer" | "listPlayers" | "listNodes">;
  /** Client-side sources. */
  readonly resolvers: {
    /**
     * Adds a resolver.
     *
     * @param resolver - The resolver.
     * @returns A function that removes it.
     */
    register(resolver: Resolver): () => void;
  };
  /** Middleware. */
  readonly hooks: {
    /**
     * Adds a hook.
     *
     * @param name - Hook name.
     * @param hook - The hook.
     * @param options - Priority; higher runs first.
     * @returns A function that removes it.
     */
    add<Name extends HookName>(
      name: Name,
      hook: HookMap[Name],
      options?: PriorityOptions,
    ): () => void;
  };
  /** Autoplay. */
  readonly autoplay: {
    /**
     * Adds an autoplay strategy.
     *
     * @param strategy - The strategy.
     * @param position - `first` to run before the built-ins. Defaults to `first`.
     * @returns A function that removes it.
     */
    register(strategy: AutoplayStrategy, position?: "first" | "last"): () => void;
  };
  /** Filter presets. */
  readonly filters: {
    /**
     * Adds a preset.
     *
     * @param preset - The preset.
     * @returns A function that removes it.
     */
    registerPreset(preset: FilterPreset): () => void;
  };
  /** Capabilities of custom server plugins. */
  readonly capabilities: {
    /**
     * Adds a capability rule.
     *
     * @param rule - The rule.
     * @returns A function that removes it.
     */
    registerRule(rule: CapabilityRule): () => void;
  };
  /** Events. */
  readonly events: {
    /**
     * Listens to an event. Errors in the listener are reported as `pluginError`.
     *
     * @param name - Event name.
     * @param listener - Listener.
     * @returns A function that stops listening.
     */
    on<Name extends keyof LunalinkEvents>(
      name: Name,
      listener: Listener<LunalinkEvents[Name]>,
    ): () => void;
    /**
     * Emits a plugin event. The name must start with `<plugin name>:`.
     *
     * @param name - Event name.
     * @param args - Arguments.
     */
    emit(name: `${string}:${string}`, ...args: unknown[]): void;
    /**
     * Runs before listeners see an event.
     *
     * @param name - Event name.
     * @param interceptor - Interceptor.
     * @param options - Priority; higher runs first.
     * @returns A function that removes it.
     */
    intercept(
      name: keyof LunalinkEvents,
      interceptor: EventInterceptor,
      options?: PriorityOptions,
    ): () => void;
    /**
     * Turns a raw server event Lunalink doesn't know into a plugin event.
     *
     * @param type - The server event `type`.
     * @param mapper - The mapper.
     * @returns A function that removes it.
     */
    registerMapper(type: string, mapper: EventMapper): () => void;
  };
  /** Custom playback engines. */
  readonly backends: {
    /**
     * Adds a backend.
     *
     * @param backend - The backend.
     * @returns A function that removes it.
     */
    register(backend: PlaybackBackend): () => void;
  };
  /** Replaceable parts. List them in the plugin's `slots` first. */
  readonly slots: {
    /**
     * Replaces a part.
     *
     * @param name - Slot.
     * @param value - Replacement.
     */
    set<Name extends SlotName>(name: Name, value: SlotValues[Name]): void;
  };
  /** Namespaced storage. */
  readonly storage: PluginStorage;
  /** Namespaced per-track data. */
  readonly trackData: PluginTrackData;
  /** Timers that are cleared on teardown. */
  readonly timers: TimerRegistry;
  /** Aborts on teardown. */
  readonly signal: AbortSignal;
  /** Logger. */
  readonly logger: PluginLogger;
}
