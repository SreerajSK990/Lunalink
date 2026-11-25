import type { DebugEvent } from "../events/DebugEvent.js";
import type { ResumeInfo } from "../lifecycle/resumeMath.js";
import type { NodeManagerEvents } from "../node/NodeManager.js";
import type { Player } from "../player/Player.js";
import type { PlayerEventMap } from "../player/types.js";
import type { ApiEventBase } from "../protocol/index.js";

/**
 * Events plugins emit. Names are `<plugin>:<event>`. Add yours with declaration merging so
 * listeners are typed:
 *
 * @example
 * ```ts
 * declare module "lunalink" {
 *   interface LunalinkCustomEvents {
 *     "stats:milestone": [player: Player, plays: number];
 *   }
 * }
 * ```
 */
export interface LunalinkCustomEvents extends Record<`${string}:${string}`, unknown[]> {}

/**
 * Events from the lifecycle and plugin layers.
 */
export interface LifecycleEventMap {
  /** A player came back after a node reconnect or a restart. */
  playerResumed: [player: Player, info: ResumeInfo];
  /** A plugin call threw or timed out. Playback carried on. */
  pluginError: [plugin: string, label: string, error: unknown];
  /** A structured log line. */
  debug: [event: DebugEvent];
}

/**
 * Every event `lunalink.on()` knows: node events, player events, lifecycle events and plugin
 * events.
 */
export type LunalinkEvents = NodeManagerEvents &
  PlayerEventMap<Player> &
  LifecycleEventMap &
  LunalinkCustomEvents;

/**
 * Name of a built-in event (not a plugin event).
 */
export type BuiltInEventName =
  keyof NodeManagerEvents | keyof PlayerEventMap<Player> | keyof LifecycleEventMap;

/**
 * An event on its way to listeners, as interceptors see it.
 */
export interface InterceptedEvent<Args extends unknown[] = unknown[]> {
  /** Event name. */
  readonly name: string;
  /** Event arguments. They can't be replaced; built-in fields stay as they are. */
  readonly args: Readonly<Args>;
  /** Whether an interceptor already suppressed it. */
  readonly suppressed: boolean;
  /**
   * Stops the event from reaching listeners. Reported in `debug`.
   *
   * @param reason - Why, for the log.
   */
  suppress(reason?: string): void;
}

/**
 * Runs before listeners see an event. Return a promise to hold the event until it settles.
 */
export type EventInterceptor<Args extends unknown[] = unknown[]> = (
  event: InterceptedEvent<Args>,
) => void | Promise<void>;

/**
 * Turns a raw server event that Lunalink doesn't know into a plugin event.
 *
 * @param payload - The raw event.
 * @param player - The guild's player, when there is one.
 * @returns The plugin event to emit, or `null` to ignore it.
 */
export type EventMapper = (
  payload: ApiEventBase,
  player: Player | undefined,
) => { name: `${string}:${string}`; args: unknown[] } | null;
