import type { PluginContext } from "./PluginContext.js";
import type { SlotName } from "./slots.js";

/**
 * The plugin API version this build of Lunalink speaks. It changes only when the plugin
 * contract breaks, independently of the package version.
 */
export const PLUGIN_API_VERSION = 1;

/**
 * Releases what a plugin's `setup` created that the context doesn't clean up by itself.
 */
export type PluginTeardown = () => void | Promise<void>;

/**
 * A Lunalink plugin. Usually exported as a factory that takes options:
 *
 * @example
 * ```ts
 * export const nowPlayingLogger = (prefix = "Now playing:") =>
 *   definePlugin({
 *     name: "now-playing-logger",
 *     version: "1.0.0",
 *     apiVersion: 1,
 *     setup(ctx) {
 *       ctx.events.on("trackStart", (player, track) => {
 *         ctx.logger.info(`${prefix} ${track.title} in ${player.guildId}`);
 *       });
 *     },
 *   });
 * ```
 */
export interface LunalinkPlugin {
  /** Unique name, for example `spotify-resolver`. */
  readonly name: string;
  /** The plugin's own version. */
  readonly version: string;
  /** Plugin API version it was written for. Must equal {@link PLUGIN_API_VERSION}. */
  readonly apiVersion: number;
  /** Plugins that must be set up first. */
  readonly dependsOn?: readonly string[];
  /** Slots this plugin replaces. Two plugins can't own the same slot. */
  readonly slots?: readonly SlotName[];
  /** Plugins whose slots this one may take over. */
  readonly overrides?: readonly string[];
  /** How long `setup` may take, in milliseconds. Defaults to 10000. */
  readonly setupTimeoutMs?: number;
  /**
   * Registers resolvers, hooks, listeners and so on. Runs before nodes connect.
   *
   * @param context - What the plugin may use. Everything registered through it is removed
   *   automatically on teardown.
   * @returns Optionally, a teardown function for anything else.
   */
  setup(context: PluginContext): PluginTeardown | undefined | Promise<PluginTeardown | undefined>;
}

/**
 * Where a plugin stands.
 */
export type PluginStatus = "pending" | "active" | "failed" | "removed";

/**
 * What `lunalink.plugins.list()` shows for a plugin.
 */
export interface PluginInfo {
  /** Name. */
  name: string;
  /** Version. */
  version: string;
  /** Status. */
  status: PluginStatus;
  /** Why it failed, when it did. */
  error: unknown;
}

/**
 * Types a plugin without changing it.
 *
 * @param plugin - The plugin.
 * @returns The same plugin.
 */
export function definePlugin<P extends LunalinkPlugin>(plugin: P): P {
  return plugin;
}
