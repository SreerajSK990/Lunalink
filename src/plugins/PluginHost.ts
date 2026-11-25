import type { CapabilityRule } from "../capabilities/CapabilityRule.js";
import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import type { FilterPreset } from "../filters/types.js";
import type { PlaybackBackend } from "./backends.js";
import { type ContextHandle, createContext, looksLikePlugin } from "./createContext.js";
import { EventBus } from "./EventBus.js";
import type { EventMapper } from "./events.js";
import { Hooks } from "./hooks.js";
import { isolate, type PluginErrorHandler } from "./isolate.js";
import { OrderedRegistry } from "./OrderedRegistry.js";
import {
  type LunalinkPlugin,
  PLUGIN_API_VERSION,
  type PluginInfo,
  type PluginStatus,
  type PluginTeardown,
} from "./Plugin.js";
import type { PluginServices } from "./PluginContext.js";
import {
  type PluginResolution,
  runResolvers,
  explainQuery,
  type QueryExplanation,
} from "./runResolvers.js";
import type { Resolver, SearchInput } from "./resolvers.js";
import { SlotRegistry } from "./slots.js";

/**
 * Plugin host settings.
 */
export interface PluginHostOptions {
  /** Default `setup` timeout, in milliseconds. Defaults to 10000. */
  setupTimeoutMs?: number;
  /** Timeout for resolvers, hooks and async interceptors, in milliseconds. Defaults to 5000. */
  callTimeoutMs?: number;
}

interface Installed {
  plugin: LunalinkPlugin;
  status: PluginStatus;
  error: unknown;
  handle: ContextHandle | null;
  teardown: PluginTeardown | null;
}

/**
 * Installs, runs and removes plugins. Available as `lunalink.plugins`.
 */
export class PluginHost {
  /** Client-side resolvers. */
  readonly resolvers: OrderedRegistry<Resolver> = new OrderedRegistry<Resolver>();
  /** Filter presets from plugins. */
  readonly presets: OrderedRegistry<FilterPreset> = new OrderedRegistry<FilterPreset>();
  /** Capability rules from plugins. */
  readonly capabilityRules: OrderedRegistry<CapabilityRule> = new OrderedRegistry<CapabilityRule>();
  /** Event mappers. */
  readonly mappers: OrderedRegistry<{ type: string; mapper: EventMapper }> = new OrderedRegistry<{
    type: string;
    mapper: EventMapper;
  }>();
  /** Custom backends. */
  readonly backendRegistry: OrderedRegistry<PlaybackBackend> =
    new OrderedRegistry<PlaybackBackend>();
  /** Hooks. */
  readonly hooks: Hooks;
  /** Replaced parts. */
  readonly slots: SlotRegistry = new SlotRegistry();
  /** Event interception. */
  readonly bus: EventBus;
  readonly #services: PluginServices;
  readonly #onError: PluginErrorHandler;
  readonly #setupTimeoutMs: number;
  readonly #callTimeoutMs: number;
  readonly #installed = new Map<string, Installed>();
  readonly #order: string[] = [];
  #started = false;

  /**
   * Creates the host.
   *
   * @param services - What the core offers plugins.
   * @param onError - Reports failing plugin code, as `pluginError`.
   * @param options - Timeouts.
   */
  constructor(
    services: PluginServices,
    onError: PluginErrorHandler,
    options: PluginHostOptions = {},
  ) {
    this.#services = services;
    this.#onError = onError;
    this.#setupTimeoutMs = Math.max(1, options.setupTimeoutMs ?? 10_000);
    this.#callTimeoutMs = Math.max(1, options.callTimeoutMs ?? 5_000);
    this.hooks = new Hooks(onError, this.#callTimeoutMs);
    this.bus = new EventBus({
      onError,
      debug: (event) => {
        services.debug(event);
      },
      timeoutMs: this.#callTimeoutMs,
    });
  }

  /**
   * Adds a plugin. Before `start()` it waits; after, it's set up right away.
   *
   * @param plugin - The plugin.
   * @returns Resolves once it's set up (or right away before `start()`).
   * @throws {LunalinkError} `PLUGIN_FAILED` or `PLUGIN_CONFLICT` when it can't be installed.
   */
  async add(plugin: LunalinkPlugin): Promise<void> {
    this.#validate(plugin);
    this.#installed.set(plugin.name, {
      plugin,
      status: "pending",
      error: null,
      handle: null,
      teardown: null,
    });
    if (this.#started) {
      this.#checkDependencies(plugin);
      this.#order.push(plugin.name);
      await this.#setup(plugin.name);
    }
  }

  /**
   * Sets up every added plugin, dependencies first. A failing plugin is marked `failed` and the
   * others carry on.
   */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    for (const name of this.#sorted()) {
      this.#order.push(name);
      await this.#setup(name);
    }
  }

  /**
   * Tears a plugin down and removes it.
   *
   * @param name - Plugin name.
   * @returns `true` when it was installed.
   * @throws {LunalinkError} `PLUGIN_CONFLICT` when an active plugin depends on it.
   */
  async remove(name: string): Promise<boolean> {
    const entry = this.#installed.get(name);
    if (!entry) return false;
    const dependents = [...this.#installed.values()].filter(
      (other) => other.status === "active" && other.plugin.dependsOn?.includes(name),
    );
    if (dependents.length > 0) {
      throw new LunalinkError(
        ErrorCode.PluginConflict,
        `Can't remove "${name}": ${dependents.map((other) => `"${other.plugin.name}"`).join(", ")} depend on it.`,
      );
    }
    await this.#teardown(entry);
    entry.status = "removed";
    this.#installed.delete(name);
    const index = this.#order.indexOf(name);
    if (index !== -1) this.#order.splice(index, 1);
    return true;
  }

  /**
   * Tears every plugin down, in reverse setup order.
   */
  async destroy(): Promise<void> {
    for (const name of [...this.#order].reverse()) {
      const entry = this.#installed.get(name);
      if (entry) {
        await this.#teardown(entry);
        entry.status = "removed";
      }
    }
    this.#installed.clear();
    this.#order.length = 0;
  }

  /**
   * Lists plugins with their status.
   *
   * @returns Plugin info.
   */
  list(): PluginInfo[] {
    return [...this.#installed.values()].map(({ plugin, status, error }) => ({
      name: plugin.name,
      version: plugin.version,
      status,
      error,
    }));
  }

  /**
   * Lists registered backends.
   *
   * @returns Backends.
   */
  backends(): PlaybackBackend[] {
    return this.backendRegistry.items();
  }

  /**
   * Shows which resolver would handle a query, and why.
   *
   * @param query - The query.
   * @returns The explanation.
   */
  explain(query: string): QueryExplanation {
    return explainQuery(this.resolvers, query, this.#onError);
  }

  /**
   * Runs the resolvers for a search.
   *
   * @param input - Search input.
   * @returns The first resolver result, or `null` to ask the node.
   */
  resolve(input: SearchInput): Promise<PluginResolution | null> {
    return runResolvers(this.resolvers, input, {
      timeoutMs: this.#callTimeoutMs,
      onError: this.#onError,
    });
  }

  #validate(plugin: LunalinkPlugin): void {
    if (!looksLikePlugin(plugin)) {
      throw new LunalinkError(
        ErrorCode.PluginFailed,
        "A plugin needs a name, version, apiVersion and setup().",
      );
    }
    if (this.#installed.has(plugin.name)) {
      throw new LunalinkError(
        ErrorCode.PluginConflict,
        `Plugin "${plugin.name}" is already installed.`,
      );
    }
    if (plugin.apiVersion !== PLUGIN_API_VERSION) {
      throw new LunalinkError(
        ErrorCode.PluginFailed,
        `Plugin "${plugin.name}" targets plugin API ${String(plugin.apiVersion)}, but this Lunalink speaks ${String(PLUGIN_API_VERSION)}.`,
        { details: { plugin: plugin.name, apiVersion: plugin.apiVersion } },
      );
    }
    this.slots.claim(plugin.name, plugin.slots ?? [], plugin.overrides ?? []);
  }

  #checkDependencies(plugin: LunalinkPlugin): void {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!this.#installed.has(dependency)) {
        throw new LunalinkError(
          ErrorCode.PluginFailed,
          `Plugin "${plugin.name}" needs "${dependency}", which isn't installed.`,
          { details: { plugin: plugin.name, dependency } },
        );
      }
    }
  }

  #sorted(): string[] {
    const order: string[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (name: string, path: string[]): void => {
      if (state.get(name) === "done") return;
      if (state.get(name) === "visiting") {
        throw new LunalinkError(
          ErrorCode.PluginConflict,
          `Plugin dependency cycle: ${[...path, name].join(" -> ")}`,
        );
      }
      const entry = this.#installed.get(name);
      if (!entry) return;
      state.set(name, "visiting");
      this.#checkDependencies(entry.plugin);
      for (const dependency of entry.plugin.dependsOn ?? []) visit(dependency, [...path, name]);
      state.set(name, "done");
      order.push(name);
    };
    for (const name of this.#installed.keys()) visit(name, []);
    return order;
  }

  async #setup(name: string): Promise<void> {
    const entry = this.#installed.get(name);
    if (!entry) return;
    const failedDependency = (entry.plugin.dependsOn ?? []).find(
      (dependency) => this.#installed.get(dependency)?.status !== "active",
    );
    if (failedDependency !== undefined) {
      entry.status = "failed";
      entry.error = new LunalinkError(
        ErrorCode.PluginFailed,
        `Dependency "${failedDependency}" isn't active.`,
      );
      this.slots.release(name);
      return;
    }
    const handle = createContext(name, this.#services, this, this.#onError);
    entry.handle = handle;
    let failure: unknown = null;
    const result = await isolate(name, "setup", () => entry.plugin.setup(handle.context), {
      timeoutMs: entry.plugin.setupTimeoutMs ?? this.#setupTimeoutMs,
      fallback: false as const,
      onError: (plugin, label, error) => {
        failure = error;
        this.#onError(plugin, label, error);
      },
    });
    if (failure !== null || result === false) {
      entry.status = "failed";
      entry.error = failure;
      await handle.dispose();
      entry.handle = null;
      return;
    }
    entry.teardown = typeof result === "function" ? result : null;
    entry.status = "active";
  }

  async #teardown(entry: Installed): Promise<void> {
    const teardown = entry.teardown;
    entry.teardown = null;
    if (teardown) {
      await isolate(entry.plugin.name, "teardown", teardown, {
        timeoutMs: this.#setupTimeoutMs,
        fallback: undefined,
        onError: this.#onError,
      });
    }
    await entry.handle?.dispose();
    entry.handle = null;
    this.slots.release(entry.plugin.name);
  }
}
