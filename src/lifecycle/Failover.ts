import type { DebugEvent } from "../events/DebugEvent.js";
import type { Node } from "../node/Node.js";
import type { NodeManager } from "../node/NodeManager.js";
import type { Player } from "../player/Player.js";

/**
 * Failover settings.
 */
export interface FailoverOptions {
  /** Turn failover on. Defaults to `true`. */
  enabled?: boolean;
  /** How long a node may stay disconnected before its players move, in milliseconds. Defaults to 10000. */
  graceMs?: number;
  /** How many players move at the same time. Defaults to 5. */
  concurrency?: number;
}

/**
 * What failover needs from the Lunalink instance.
 */
export interface FailoverHost {
  /** The node manager. */
  nodes: NodeManager;
  /**
   * Lists the players on one node.
   *
   * @param node - The node.
   * @returns Players on it.
   */
  playersOn(node: Node): Player[];
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

/**
 * Moves players off a node that stayed down past the grace period, or that gave up reconnecting.
 * It never waits on the dead node: the new node gets the full player state, and the old one is
 * only told to clean up when it's reachable.
 */
export class Failover {
  readonly #host: FailoverHost;
  readonly #enabled: boolean;
  readonly #graceMs: number;
  readonly #concurrency: number;
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #unsubscribe: (() => void)[] = [];

  /**
   * Creates the failover watcher and starts listening to node events.
   *
   * @param host - Nodes and players.
   * @param options - Settings.
   */
  constructor(host: FailoverHost, options: FailoverOptions = {}) {
    this.#host = host;
    this.#enabled = options.enabled ?? true;
    this.#graceMs = Math.max(0, options.graceMs ?? 10_000);
    this.#concurrency = Math.max(1, options.concurrency ?? 5);
    if (!this.#enabled) return;
    const events = host.nodes.events;
    this.#unsubscribe.push(
      events.on("nodeDisconnect", (node) => {
        this.#schedule(node);
      }),
      events.on("nodeReady", (node) => {
        this.#cancel(node.id);
      }),
      events.on("nodeGiveUp", (node) => {
        this.#cancel(node.id);
        void this.evacuate(node);
      }),
      events.on("nodeDestroy", (node) => {
        this.#cancel(node.id);
        void this.evacuate(node);
      }),
    );
  }

  /**
   * Moves every player off a node now.
   *
   * @param node - The node to leave.
   * @returns How many players moved.
   */
  async evacuate(node: Node): Promise<number> {
    const players = this.#host.playersOn(node);
    if (players.length === 0) return 0;
    this.#debug("info", `Moving ${players.length} player(s) off node ${node.id}`, {
      node: node.id,
    });
    let moved = 0;
    let index = 0;
    const worker = async (): Promise<void> => {
      while (index < players.length) {
        const player = players[index++];
        if (player && (await this.#move(player, node))) moved++;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.#concurrency, players.length) }, () => worker()),
    );
    return moved;
  }

  /**
   * Stops listening and drops pending timers.
   */
  dispose(): void {
    for (const off of this.#unsubscribe.splice(0)) off();
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }

  async #move(player: Player, from: Node): Promise<boolean> {
    if (player.node !== from) return false;
    try {
      const target = this.#host.nodes.select({
        guildId: player.guildId,
        region: null,
        exclude: new Set([from.id]),
      });
      await player.moveTo(target);
      return true;
    } catch (error) {
      this.#debug("warn", `Couldn't move the player of guild ${player.guildId}`, {
        node: from.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  #schedule(node: Node): void {
    if (this.#timers.has(node.id)) return;
    const timer = setTimeout(() => {
      this.#timers.delete(node.id);
      if (!node.connected) void this.evacuate(node);
    }, this.#graceMs);
    timer.unref();
    this.#timers.set(node.id, timer);
  }

  #cancel(nodeId: string): void {
    const timer = this.#timers.get(nodeId);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#timers.delete(nodeId);
  }

  #debug(level: DebugEvent["level"], message: string, data?: Record<string, unknown>): void {
    this.#host.debug({ scope: "failover", level, message, ...(data ? { data } : {}) });
  }
}
