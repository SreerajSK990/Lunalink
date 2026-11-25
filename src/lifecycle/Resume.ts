import type { DebugEvent } from "../events/DebugEvent.js";
import type { Node } from "../node/Node.js";
import type { NodeManager } from "../node/NodeManager.js";
import type { Player } from "../player/Player.js";
import type { PlayerManager } from "../player/PlayerManager.js";
import type { ApiPlayer } from "../protocol/index.js";
import type { TrackFactory } from "../track/toSearchResult.js";
import type { Persistence } from "./Persistence.js";
import { autoTimeoutSeconds, type ResumeInfo, type ResumeStrategy } from "./resumeMath.js";
import { restoreSnapshot } from "./restoreSnapshot.js";
import { resumeLive } from "./resumeLive.js";
import type { PlayerSnapshot } from "./snapshot.js";

/**
 * Auto-resume settings.
 */
export interface ResumeOptions {
  /** Turn auto-resume on. Defaults to `true`. */
  enabled?: boolean;
  /** Session timeout in seconds, or `auto` to learn it from past downtimes. Defaults to `auto`. */
  timeoutSeconds?: number | "auto";
  /** How positions are picked. Defaults to `auto`. */
  strategy?: ResumeStrategy;
  /** How far to rewind before the listener position, or `auto`. Defaults to `auto`. */
  rewindLeadMs?: number | "auto";
  /** How long to wait for a saved player's node before rebuilding it elsewhere. Defaults to 15000. */
  nodeWaitMs?: number;
}

/**
 * What auto-resume needs from the Lunalink instance.
 */
export interface ResumeHost {
  /** Nodes. */
  nodes: NodeManager;
  /** Players. */
  players: PlayerManager;
  /** Snapshots, or `null` when there's no store. */
  persistence: Persistence | null;
  /** Builds tracks. */
  trackFactory: TrackFactory;
  /**
   * Checks whether anyone but bots sits in the player's channel.
   *
   * @param player - The player.
   * @returns `true` when someone listens, or when it can't tell.
   */
  hasListeners(player: Player): boolean;
  /**
   * Called for a player held because nobody listens, so auto-leave can take over.
   *
   * @param player - The held player.
   */
  onHold(player: Player): void;
  /**
   * Emits `playerResumed`.
   *
   * @param player - The player.
   * @param info - What happened.
   */
  emitResumed(player: Player, info: ResumeInfo): void;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

interface Away {
  since: number;
  positions: Map<string, number>;
}

/**
 * Keeps sessions resumable and brings players back after a node reconnect or a bot restart,
 * continuing from where listeners stopped hearing audio.
 */
export class Resume {
  readonly #host: ResumeHost;
  readonly #options: Required<ResumeOptions>;
  readonly #away = new Map<string, Away>();
  readonly #voiceDropped = new Set<string>();
  readonly #pending = new Map<string, PlayerSnapshot[]>();
  readonly #resumed = new Map<string, boolean>();
  readonly #unsubscribe: (() => void)[] = [];
  #lastAliveAt: number | null = null;
  #waitTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Creates auto-resume and starts listening to node events.
   *
   * @param host - Nodes, players and the store.
   * @param options - Settings.
   */
  constructor(host: ResumeHost, options: ResumeOptions = {}) {
    this.#host = host;
    this.#options = {
      enabled: options.enabled ?? true,
      timeoutSeconds: options.timeoutSeconds ?? "auto",
      strategy: options.strategy ?? "auto",
      rewindLeadMs: options.rewindLeadMs ?? "auto",
      nodeWaitMs: Math.max(0, options.nodeWaitMs ?? 15_000),
    };
    if (!this.#options.enabled) return;
    const events = host.nodes.events;
    this.#unsubscribe.push(
      events.on("nodeDisconnect", (node) => {
        this.#markAway(node);
      }),
      events.on("nodeEvent", (_node, event) => {
        if (event.type === "voiceClosed") this.#voiceDropped.add(event.guildId);
      }),
      events.on("nodeReady", (node, resumed) => {
        void this.#onReady(node, resumed);
      }),
    );
  }

  /**
   * Reads saved session ids, so nodes can resume them on their first connect. Call it before
   * connecting the nodes.
   *
   * @returns Session ids by node id.
   */
  async savedSessions(): Promise<Map<string, string>> {
    if (!this.#options.enabled || !this.#host.persistence) return new Map();
    return this.#host.persistence.sessions();
  }

  /**
   * Loads every saved player and rebuilds each one once its node is ready. Call it after the
   * Discord client is ready, so voice can be joined.
   *
   * @returns How many snapshots were found.
   */
  async restoreSaved(): Promise<number> {
    const persistence = this.#host.persistence;
    if (!this.#options.enabled || !persistence) return 0;
    this.#lastAliveAt = await persistence.lastAliveAt();
    const snapshots = await persistence.loadAll();
    for (const snapshot of snapshots) {
      if (this.#host.players.has(snapshot.guildId)) continue;
      const list = this.#pending.get(snapshot.nodeId) ?? [];
      list.push(snapshot);
      this.#pending.set(snapshot.nodeId, list);
    }
    for (const node of this.#host.nodes.ready())
      await this.#restorePending(node, this.#resumed.get(node.id) ?? false);
    if (this.#pending.size > 0) {
      this.#waitTimer = setTimeout(() => void this.#restoreOrphans(), this.#options.nodeWaitMs);
      this.#waitTimer.unref();
    }
    return snapshots.length;
  }

  /**
   * Stops listening and drops timers.
   */
  dispose(): void {
    for (const off of this.#unsubscribe.splice(0)) off();
    if (this.#waitTimer !== null) clearTimeout(this.#waitTimer);
    this.#waitTimer = null;
  }

  #markAway(node: Node): void {
    if (this.#away.has(node.id)) return;
    const positions = new Map<string, number>();
    for (const player of this.#host.players.on(node))
      positions.set(player.guildId, player.position);
    this.#away.set(node.id, { since: Date.now(), positions });
  }

  async #onReady(node: Node, resumed: boolean): Promise<void> {
    this.#resumed.set(node.id, resumed);
    await this.#configureSession(node);
    const away = this.#away.get(node.id);
    this.#away.delete(node.id);
    if (away) {
      await this.#host.persistence?.recordDowntime(Date.now() - away.since);
      const server = resumed ? await this.#serverPlayers(node) : null;
      for (const player of this.#host.players.on(node)) {
        const dropped = this.#voiceDropped.delete(player.guildId);
        await this.#guard(player.guildId, async () => {
          const info = await resumeLive(player, {
            server: server?.get(player.guildId) ?? null,
            resumed,
            voiceDropped: dropped,
            since: away.since,
            positionAtLoss: away.positions.get(player.guildId) ?? player.position,
            strategy: this.#options.strategy,
            rewindLeadMs: this.#options.rewindLeadMs,
          });
          this.#report(player, info);
        });
      }
    }
    await this.#restorePending(node, resumed);
  }

  async #restorePending(node: Node, resumed: boolean): Promise<void> {
    const list = this.#pending.get(node.id);
    if (!list) return;
    this.#pending.delete(node.id);
    const sameSession = (snapshot: PlayerSnapshot): boolean =>
      resumed && snapshot.sessionId !== null && snapshot.sessionId === node.sessionId;
    const server = list.some(sameSession) ? await this.#serverPlayers(node) : null;
    for (const snapshot of list)
      await this.#rebuild(snapshot, node, sameSession(snapshot) ? server : null);
  }

  async #restoreOrphans(): Promise<void> {
    this.#waitTimer = null;
    const leftovers = [...this.#pending.values()].flat();
    this.#pending.clear();
    for (const snapshot of leftovers) {
      const node = this.#pickNode(snapshot.guildId, snapshot.nodeId);
      if (node) await this.#rebuild(snapshot, node, null);
    }
  }

  async #rebuild(
    snapshot: PlayerSnapshot,
    node: Node,
    server: Map<string, ApiPlayer> | null,
  ): Promise<void> {
    await this.#guard(snapshot.guildId, async () => {
      const result = await restoreSnapshot(snapshot, {
        node,
        players: this.#host.players,
        trackFactory: this.#host.trackFactory,
        codec: this.#host.persistence?.codec,
        server: server?.get(snapshot.guildId) ?? null,
        lastAliveAt: this.#lastAliveAt,
        heartbeatMs: this.#host.persistence?.heartbeatMs ?? 5_000,
        strategy: this.#options.strategy,
        rewindLeadMs: this.#options.rewindLeadMs,
        hasListeners: (player) => this.#host.hasListeners(player),
      });
      if (!result) return;
      if (result.info.mode === "held") this.#host.onHold(result.player);
      this.#report(result.player, result.info);
    });
  }

  #pickNode(guildId: string, preferred: string): Node | null {
    const ready = this.#host.nodes.ready();
    const same = ready.find((node) => node.id === preferred);
    if (same) return same;
    try {
      return this.#host.nodes.select({ guildId, region: null, exclude: new Set() });
    } catch {
      return null;
    }
  }

  async #configureSession(node: Node): Promise<void> {
    const persistence = this.#host.persistence;
    const setting = this.#options.timeoutSeconds;
    const timeout =
      setting === "auto"
        ? autoTimeoutSeconds(persistence ? await persistence.downtimes() : [])
        : setting;
    try {
      await node.rest.updateSession({ resuming: true, timeout });
      if (node.sessionId) await persistence?.saveSession(node.id, node.sessionId);
    } catch (error) {
      this.#debug("warn", `Couldn't enable resuming on node ${node.id}`, error);
    }
  }

  async #serverPlayers(node: Node): Promise<Map<string, ApiPlayer>> {
    try {
      const players = await node.rest.getPlayers();
      return new Map(players.map((player) => [player.guildId, player]));
    } catch (error) {
      this.#debug("warn", `Couldn't read the players of node ${node.id}`, error);
      return new Map();
    }
  }

  async #guard(guildId: string, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.#debug("warn", `Resuming the player of guild ${guildId} failed`, error);
    }
  }

  #report(player: Player, info: ResumeInfo): void {
    this.#host.debug({
      scope: `resume:${player.guildId}`,
      level: "info",
      message: `Resumed: ${info.mode} (${info.reason})`,
      data: { gapMs: info.gapMs, confidence: info.confidence },
    });
    this.#host.emitResumed(player, info);
  }

  #debug(level: DebugEvent["level"], message: string, error: unknown): void {
    this.#host.debug({
      scope: "resume",
      level,
      message,
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
