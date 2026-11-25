export type { BackendEventMap, BackendPlayOptions, PlaybackBackend } from "./backends.js";
export { EventBus, type EventBusHost } from "./EventBus.js";
export type {
  BuiltInEventName,
  EventInterceptor,
  EventMapper,
  InterceptedEvent,
  LifecycleEventMap,
  LunalinkCustomEvents,
  LunalinkEvents,
} from "./events.js";
export { Hooks, type HookMap, type HookName } from "./hooks.js";
export { isolate, isolateSync, type IsolateOptions, type PluginErrorHandler } from "./isolate.js";
export { OrderedRegistry, type RegistryEntry } from "./OrderedRegistry.js";
export {
  definePlugin,
  PLUGIN_API_VERSION,
  type LunalinkPlugin,
  type PluginInfo,
  type PluginStatus,
  type PluginTeardown,
} from "./Plugin.js";
export type {
  PluginContext,
  PluginLogger,
  PluginServices,
  PluginStorage,
  PluginTrackData,
  PriorityOptions,
} from "./PluginContext.js";
export { PluginHost, type PluginHostOptions } from "./PluginHost.js";
export {
  validateResolveResult,
  type ResolveContext,
  type ResolvedItem,
  type ResolveResult,
  type Resolver,
  type SearchInput,
} from "./resolvers.js";
export { type PluginResolution, type QueryExplanation } from "./runResolvers.js";
export { SlotRegistry, type MirrorMatcher, type SlotName, type SlotValues } from "./slots.js";
