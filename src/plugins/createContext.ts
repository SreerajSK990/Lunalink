import type { CapabilityRule } from "../capabilities/CapabilityRule.js";
import { ValidationError } from "../errors/ValidationError.js";
import type { DebugLevel } from "../events/DebugEvent.js";
import type { FilterPreset } from "../filters/types.js";
import type { JsonObject } from "../protocol/index.js";
import { Disposer } from "../utils/Disposer.js";
import { isRecord } from "../utils/guards.js";
import { TimerRegistry } from "../utils/TimerRegistry.js";
import type { PlaybackBackend } from "./backends.js";
import type { EventBus } from "./EventBus.js";
import type { EventMapper } from "./events.js";
import type { Hooks } from "./hooks.js";
import type { PluginErrorHandler } from "./isolate.js";
import type { OrderedRegistry } from "./OrderedRegistry.js";
import { PLUGIN_API_VERSION } from "./Plugin.js";
import type { PluginContext, PluginServices } from "./PluginContext.js";
import type { Resolver } from "./resolvers.js";
import type { SlotRegistry } from "./slots.js";

/**
 * The registries a context writes into.
 */
export interface ContextRegistries {
  /** Resolvers. */
  resolvers: OrderedRegistry<Resolver>;
  /** Presets. */
  presets: OrderedRegistry<FilterPreset>;
  /** Capability rules. */
  capabilityRules: OrderedRegistry<CapabilityRule>;
  /** Event mappers, with their server event type. */
  mappers: OrderedRegistry<{ type: string; mapper: EventMapper }>;
  /** Backends. */
  backendRegistry: OrderedRegistry<PlaybackBackend>;
  /** Hooks. */
  hooks: Hooks;
  /** Slots. */
  slots: SlotRegistry;
  /** Event interception. */
  bus: EventBus;
}

/**
 * A context plus what tears it down.
 */
export interface ContextHandle {
  /** The context handed to `setup`. */
  context: PluginContext;
  /** Runs every cleanup step. */
  dispose(): Promise<void>;
}

/**
 * Builds the context for one plugin. Everything it registers is tracked and released by
 * `dispose()`.
 *
 * @param name - Plugin name.
 * @param services - What the core offers.
 * @param registries - Where registrations go.
 * @param onError - Reports failing plugin code.
 * @returns The context and its cleanup.
 */
export function createContext(
  name: string,
  services: PluginServices,
  registries: ContextRegistries,
  onError: PluginErrorHandler,
): ContextHandle {
  const disposer = new Disposer();
  const controller = new AbortController();
  const timers = new TimerRegistry();
  const track = (remove: () => void): (() => void) => {
    disposer.add(remove);
    return remove;
  };
  const log = (level: DebugLevel) => (message: string, data?: Record<string, unknown>) => {
    services.debug({ scope: `plugin:${name}`, level, message, ...(data ? { data } : {}) });
  };
  const namespace = `plugin:${name}:`;
  const dataKey = `plugin:${name}`;
  const context: PluginContext = {
    name,
    apiVersion: PLUGIN_API_VERSION,
    lunalink: {
      search: (input) => services.search(input),
      getPlayer: (guildId) => services.getPlayer(guildId),
      listPlayers: () => services.listPlayers(),
      listNodes: () => services.listNodes(),
    },
    resolvers: {
      register: (resolver) =>
        track(registries.resolvers.add(name, resolver, resolver.priority ?? 0)),
    },
    hooks: {
      add: (hookName, hook, options) =>
        track(registries.hooks.add(name, hookName, hook, options?.priority ?? 0)),
    },
    autoplay: {
      register: (strategy, position = "first") =>
        track(services.addAutoplayStrategy(strategy, position)),
    },
    filters: {
      registerPreset: (preset) => track(registries.presets.add(name, preset)),
    },
    capabilities: {
      registerRule: (rule) => track(registries.capabilityRules.add(name, rule)),
    },
    events: {
      on: (eventName, listener) =>
        track(
          services.on(eventName, (...args) => {
            try {
              const result = listener(...args);
              if (result instanceof Promise) {
                result.catch((error: unknown) => {
                  onError(name, `listener ${eventName}`, error);
                });
              }
            } catch (error) {
              onError(name, `listener ${eventName}`, error);
            }
          }),
        ),
      emit: (eventName, ...args) => {
        if (!eventName.startsWith(`${name}:`)) {
          throw new ValidationError("name", `plugin events must start with "${name}:"`);
        }
        services.emitCustom(eventName, args);
      },
      intercept: (eventName, interceptor, options) =>
        track(registries.bus.intercept(name, eventName, interceptor, options?.priority ?? 0)),
      registerMapper: (type, mapper) => track(registries.mappers.add(name, { type, mapper })),
    },
    backends: {
      register: (backend) => track(registries.backendRegistry.add(name, backend)),
    },
    slots: {
      set: (slotName, value) => {
        registries.slots.set(name, slotName, value);
      },
    },
    storage: {
      get: async (key) => services.store().get(namespace + key),
      set: async (key, value) => {
        await services.store().set(namespace + key, value);
      },
      delete: async (key) => {
        await services.store().delete(namespace + key);
      },
      keys: async () =>
        (await services.store().keys(namespace)).map((key) => key.slice(namespace.length)),
    },
    trackData: {
      get: (target) => target.userData[dataKey],
      with: (target, value) => {
        const userData: JsonObject = { ...target.userData, [dataKey]: value };
        return target.withUserData(userData);
      },
    },
    timers,
    signal: controller.signal,
    logger: { trace: log("trace"), info: log("info"), warn: log("warn"), error: log("error") },
  };
  disposer.add(() => {
    timers.clearAll();
  });
  disposer.add(() => {
    controller.abort();
  });
  return {
    context,
    dispose: async () => {
      const errors = await disposer.dispose();
      registries.resolvers.removeOwner(name);
      registries.presets.removeOwner(name);
      registries.capabilityRules.removeOwner(name);
      registries.mappers.removeOwner(name);
      registries.backendRegistry.removeOwner(name);
      registries.hooks.removeOwner(name);
      registries.bus.removeOwner(name);
      registries.slots.release(name);
      for (const error of errors) onError(name, "teardown", error);
    },
  };
}

/**
 * Checks whether a value looks like a plugin.
 *
 * @param value - Anything.
 * @returns `true` when it has a name, a version, an `apiVersion` and `setup`.
 */
export function looksLikePlugin(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    typeof value["version"] === "string" &&
    typeof value["apiVersion"] === "number" &&
    typeof value["setup"] === "function"
  );
}
