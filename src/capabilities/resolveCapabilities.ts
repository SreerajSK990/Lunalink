import type { Capability } from "./Capability.js";
import type { CapabilityContext, CapabilityRule } from "./CapabilityRule.js";
import { CapabilitySet } from "./CapabilitySet.js";
import { builtInCapabilityRules } from "./builtInRules.js";

/**
 * Builds a node's capability set from its info, the built-in rules, rules added by plugins, and
 * capabilities the user says the node has even though it doesn't report them.
 *
 * @param nodeId - Node id, used in error messages.
 * @param context - The node's info.
 * @param extraRules - Rules registered by plugins.
 * @param assumed - Capabilities from the node's `assumeCapabilities` option.
 * @returns The capability set.
 */
export function resolveCapabilities(
  nodeId: string,
  context: CapabilityContext,
  extraRules: readonly CapabilityRule[] = [],
  assumed: readonly Capability[] = [],
): CapabilitySet {
  const found: Capability[] = [...assumed];
  for (const rule of [...builtInCapabilityRules, ...extraRules]) {
    for (const capability of rule(context)) found.push(capability);
  }
  return new CapabilitySet(nodeId, found);
}
