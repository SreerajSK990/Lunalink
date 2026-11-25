import type { Node } from "../Node.js";
import { nodePenalty } from "./penalty.js";

/**
 * What a selector knows about the player that needs a node.
 */
export interface NodeSelectionContext {
  /** Guild the player belongs to. */
  guildId: string;
  /** Voice region parsed from the Discord voice endpoint, when known. */
  region: string | null;
  /** Nodes that must not be picked, for example the one that just failed. */
  exclude: ReadonlySet<string>;
}

/**
 * Picks a node from the ready ones.
 *
 * @param nodes - Ready nodes, already filtered by `exclude`. Never empty.
 * @param context - The player's guild and region.
 * @returns The chosen node, or `undefined` to fall back to `leastLoad`.
 */
export type NodeSelector = (
  nodes: readonly Node[],
  context: NodeSelectionContext,
) => Node | undefined;

/**
 * Names of the built-in strategies.
 */
export type NodeSelectionStrategy =
  | "leastLoad"
  | "leastPlayers"
  | "leastPlayingPlayers"
  | "leastMemory"
  | "leastCpu"
  | "priority"
  | "random"
  | "region";

function lowest(nodes: readonly Node[], score: (node: Node) => number): Node | undefined {
  let best: Node | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const value = score(node);
    if (value < bestScore || (value === bestScore && best && tieBreak(node, best) < 0)) {
      best = node;
      bestScore = value;
    }
  }
  return best;
}

function tieBreak(a: Node, b: Node): number {
  if (a.options.priority !== b.options.priority) return b.options.priority - a.options.priority;
  return a.id.localeCompare(b.id);
}

const leastLoad: NodeSelector = (nodes) => lowest(nodes, (node) => nodePenalty(node.stats));

/**
 * The built-in strategies.
 */
export const selectionStrategies: Readonly<Record<NodeSelectionStrategy, NodeSelector>> = {
  leastLoad,
  leastPlayers: (nodes) => lowest(nodes, (node) => node.stats?.players ?? 0),
  leastPlayingPlayers: (nodes) => lowest(nodes, (node) => node.stats?.playingPlayers ?? 0),
  leastMemory: (nodes) => lowest(nodes, (node) => node.stats?.memory.used ?? 0),
  leastCpu: (nodes) => lowest(nodes, (node) => node.stats?.cpu.serverLoad ?? 0),
  priority: (nodes) => lowest(nodes, (node) => -node.options.priority),
  random: (nodes) => nodes[Math.floor(Math.random() * nodes.length)],
  region: (nodes, context) => {
    const region = context.region;
    const local = region ? nodes.filter((node) => node.options.regions.includes(region)) : [];
    return leastLoad(local.length > 0 ? local : nodes, context);
  },
};
