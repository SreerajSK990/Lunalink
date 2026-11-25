import type { Capability } from "./Capability.js";

/**
 * What a capability rule can look at.
 */
export interface CapabilityContext {
  /** `lavalink` or `nodelink`. */
  kind: "lavalink" | "nodelink";
  /** Server plugin names from `/v4/info`. */
  plugins: readonly string[];
  /** Source manager names from `/v4/info`. */
  sourceManagers: readonly string[];
  /** Filter names from `/v4/info`. */
  filters: readonly string[];
  /** Server version. */
  version: { major: number; minor: number; patch: number };
  /** The raw `/v4/info` body. */
  raw: unknown;
}

/**
 * A function that adds capabilities based on what a node reports. Plugins register these to
 * teach Lunalink about custom server plugins.
 *
 * @param context - The node's info.
 * @returns Capabilities to add.
 */
export type CapabilityRule = (context: CapabilityContext) => Iterable<Capability>;
