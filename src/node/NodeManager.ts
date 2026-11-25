import type { NodeEvent, NodeInfo, NodeStats } from "../drivers/types.js";
import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import { ValidationError } from "../errors/ValidationError.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import type { ApiPlayerState } from "../protocol/index.js";
import { Node, type NodeRuntime } from "./Node.js";
import type { NodeOptions } from "./NodeOptions.js";
import { resolveNodeOptions } from "./resolveNodeOptions.js";
import {
  selectionStrategies,
  type NodeSelectionContext,
  type NodeSelectionStrategy,
  type NodeSelector,
} from "./selection/strategies.js";

/**
 * Node events relayed by the manager, each with the node as the first argument.
 */
export interface NodeManagerEvents {
  /** A node was added. */
  nodeCreate: [node: Node];
  /** A node is ready. */
  nodeReady: [node: Node, resumed: boolean];
  /** A node's info was read. */
  nodeInfo: [node: Node, info: NodeInfo];
  /** A node's connection closed. */
  nodeDisconnect: [node: Node, code: number, reason: string];
  /** A node will retry its connection. */
  nodeReconnecting: [node: Node, attempt: number, delayMs: number];
  /** A node gave up reconnecting. */
  nodeGiveUp: [node: Node, error: unknown];
  /** Something went wrong on a node. */
  nodeError: [node: Node, error: unknown];
  /** A node sent stats. */
  nodeStats: [node: Node, stats: NodeStats];
  /** A node sent a player update. */
  nodePlayerUpdate: [node: Node, guildId: string, state: ApiPlayerState];
  /** A node sent an event. */
  nodeEvent: [node: Node, event: NodeEvent];
  /** A node sent a message. */
  nodeRaw: [node: Node, payload: unknown];
  /** A node was removed. */
  nodeDestroy: [node: Node];
}

/**
 * Holds every node and picks one for each new player.
 */
export class NodeManager {
  /** Relayed node events. */
  readonly events: TypedEmitter<NodeManagerEvents> = new TypedEmitter<NodeManagerEvents>();
  readonly #nodes = new Map<string, Node>();
  readonly #runtime: NodeRuntime;
  #selector: NodeSelector;

  /**
   * Creates the manager.
   *
   * @param runtime - Services passed to every node.
   * @param selection - Strategy name or custom selector.
   */
  constructor(runtime: NodeRuntime, selection: NodeSelectionStrategy | NodeSelector = "leastLoad") {
    this.#runtime = runtime;
    this.#selector = typeof selection === "function" ? selection : selectionStrategies[selection];
  }

  /**
   * Number of nodes.
   *
   * @returns Node count.
   */
  get size(): number {
    return this.#nodes.size;
  }

  /**
   * Changes how nodes are picked for new players.
   *
   * @param selection - Strategy name or custom selector.
   */
  setSelector(selection: NodeSelectionStrategy | NodeSelector): void {
    this.#selector = typeof selection === "function" ? selection : selectionStrategies[selection];
  }

  /**
   * Adds a node. It isn't connected until you call `connect()` on it or on the manager.
   *
   * @param options - Node settings.
   * @param field - Option path for error messages.
   * @returns The node.
   * @throws {ValidationError} When the options are invalid or the id is taken.
   */
  add(options: NodeOptions, field = "node"): Node {
    const resolved = resolveNodeOptions(options, field);
    if (this.#nodes.has(resolved.id)) {
      throw new ValidationError(
        `${field}.id`,
        `a node called "${resolved.id}" already exists`,
        true,
      );
    }
    const node = new Node(resolved, this.#runtime);
    this.#nodes.set(node.id, node);
    this.#relay(node);
    this.events.emit("nodeCreate", node);
    return node;
  }

  /**
   * Gets a node by id.
   *
   * @param id - Node id.
   * @returns The node, or `undefined`.
   */
  get(id: string): Node | undefined {
    return this.#nodes.get(id);
  }

  /**
   * Gets a node by id, or throws.
   *
   * @param id - Node id.
   * @returns The node.
   * @throws {LunalinkError} `NODE_NOT_FOUND` when there's no such node.
   */
  require(id: string): Node {
    const node = this.#nodes.get(id);
    if (!node) {
      throw new LunalinkError(ErrorCode.NodeNotFound, `There is no node called "${id}".`, {
        details: { nodeId: id },
      });
    }
    return node;
  }

  /**
   * Lists every node.
   *
   * @returns Nodes in the order they were added.
   */
  list(): Node[] {
    return [...this.#nodes.values()];
  }

  /**
   * Lists nodes that are ready.
   *
   * @returns Ready nodes.
   */
  ready(): Node[] {
    return this.list().filter((node) => node.connected);
  }

  /**
   * Connects every node. One failing node doesn't stop the others.
   *
   * @returns One result per node.
   */
  connectAll(): Promise<PromiseSettledResult<void>[]> {
    return Promise.allSettled(this.list().map((node) => node.connect()));
  }

  /**
   * Picks a ready node for a player.
   *
   * @param context - Guild, region and nodes to skip.
   * @returns The chosen node.
   * @throws {LunalinkError} `NO_NODES_AVAILABLE` when no node is ready.
   */
  select(context: NodeSelectionContext): Node {
    const candidates = this.ready().filter((node) => !context.exclude.has(node.id));
    if (candidates.length === 0) {
      throw new LunalinkError(ErrorCode.NoNodesAvailable, "No node is connected right now.", {
        details: {
          guildId: context.guildId,
          nodes: this.list().map((node) => `${node.id}:${node.state}`),
        },
      });
    }
    const chosen =
      this.#selector(candidates, context) ?? selectionStrategies.leastLoad(candidates, context);
    if (!chosen) throw new LunalinkError(ErrorCode.NoNodesAvailable, "No node could be selected.");
    return chosen;
  }

  /**
   * Removes a node and closes its connection. Players on it must be moved first; Lunalink's
   * failover does that for you.
   *
   * @param id - Node id.
   * @returns `true` when a node was removed.
   */
  remove(id: string): boolean {
    const node = this.#nodes.get(id);
    if (!node) return false;
    this.#nodes.delete(id);
    this.events.emit("nodeDestroy", node);
    node.destroy();
    return true;
  }

  /**
   * Removes every node.
   */
  destroyAll(): void {
    for (const id of [...this.#nodes.keys()]) this.remove(id);
  }

  #relay(node: Node): void {
    const { events } = node;
    const relay = this.events;
    events.on("ready", (resumed) => {
      relay.emit("nodeReady", node, resumed);
    });
    events.on("info", (info) => {
      relay.emit("nodeInfo", node, info);
    });
    events.on("disconnect", (code, reason) => {
      relay.emit("nodeDisconnect", node, code, reason);
    });
    events.on("reconnecting", (attempt, delayMs) => {
      relay.emit("nodeReconnecting", node, attempt, delayMs);
    });
    events.on("giveUp", (error) => {
      relay.emit("nodeGiveUp", node, error);
    });
    events.on("error", (error) => {
      relay.emit("nodeError", node, error);
    });
    events.on("stats", (stats) => {
      relay.emit("nodeStats", node, stats);
    });
    events.on("playerUpdate", (guildId, state) => {
      relay.emit("nodePlayerUpdate", node, guildId, state);
    });
    events.on("event", (event) => {
      relay.emit("nodeEvent", node, event);
    });
    events.on("raw", (payload) => {
      relay.emit("nodeRaw", node, payload);
    });
  }
}
