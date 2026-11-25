import type { DebugEvent, DebugLevel } from "../events/DebugEvent.js";
import { TypedEmitter } from "../events/TypedEmitter.js";
import { AutoLeave } from "../lifecycle/AutoLeave.js";
import { Autoplay } from "../lifecycle/Autoplay.js";
import { Failover } from "../lifecycle/Failover.js";
import { Persistence } from "../lifecycle/Persistence.js";
import { Resume } from "../lifecycle/Resume.js";
import type { Node } from "../node/Node.js";
import { NodeManager, type NodeManagerEvents } from "../node/NodeManager.js";
import { resolveNodeOptions } from "../node/resolveNodeOptions.js";
import { PlayerManager } from "../player/PlayerManager.js";
import type { PlayerDefaults } from "../player/PlayerRuntime.js";
import type { LunalinkEvents } from "../plugins/events.js";
import type { ApiEventBase } from "../protocol/index.js";
import { PluginHost } from "../plugins/PluginHost.js";
import type { SearchInput } from "../plugins/resolvers.js";
import { pickBestMatch } from "../search/mirror.js";
import { MemoryStore } from "../stores/MemoryStore.js";
import type { PlayerStore } from "../stores/PlayerStore.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { SearchResult } from "../track/SearchResult.js";
import { defaultTrackFactory, type TrackFactory } from "../track/toSearchResult.js";
import { builtInSocketFactory } from "../transport/ws/SocketFactory.js";
import { CLIENT_NAME } from "../version.js";
import { VoiceStateCache } from "../voice/VoiceStateCache.js";
import type { GatewayPacket } from "./GatewayAdapter.js";
import { createLifecycleTap } from "./lifecycleTap.js";
import { checkOptions, type LunalinkOptions } from "./LunalinkOptions.js";
import { createPlayerRuntime } from "./playerRuntime.js";
import { routeRawPacket } from "./rawPackets.js";
import { mirrorTrack, runSearch } from "./searchFlow.js";

/**
 * How `shutdown()` stops.
 */
export interface ShutdownOptions {
  /**
   * `destroy` (default) leaves voice and forgets every player. `pause` pauses every player,
   * saves snapshots and closes the node connections, so the next start resumes where it stopped.
   */
  mode?: "destroy" | "pause";
}

const NODE_EVENTS: readonly (keyof NodeManagerEvents)[] = [
  "nodeCreate",
  "nodeReady",
  "nodeInfo",
  "nodeDisconnect",
  "nodeReconnecting",
  "nodeGiveUp",
  "nodeError",
  "nodeStats",
  "nodePlayerUpdate",
  "nodeEvent",
  "nodeRaw",
  "nodeDestroy",
];

/**
 * The Lunalink client. Create one per bot, pass it your Discord library's adapter and your
 * nodes, then call `connect()` once the bot is logged in.
 *
 * @example
 * ```ts
 * const lunalink = new Lunalink({
 *   adapter: discordjs(client),
 *   nodes: [{ id: "main", host: "localhost", port: 2333, password: "youshallnotpass" }],
 * });
 * client.once("ready", () => void lunalink.connect());
 * lunalink.on("trackStart", (player, track) => console.log(`Now playing ${track.title}`));
 * ```
 */
export class Lunalink extends TypedEmitter<LunalinkEvents> {
  /** The options you passed. */
  readonly options: Readonly<LunalinkOptions>;
  /** Nodes. They are created by `connect()`. */
  readonly nodes: NodeManager;
  /** Players. */
  readonly players: PlayerManager;
  /** Plugins. */
  readonly plugins: PluginHost;
  /** Who sits in which voice channel. */
  readonly voiceStates: VoiceStateCache = new VoiceStateCache();
  /** Autoplay. */
  readonly autoplay: Autoplay;
  /** Idle timers. */
  readonly autoLeave: AutoLeave;
  /** Failover. */
  readonly failover: Failover;
  /** Snapshots, or `null` when resume is off. */
  readonly persistence: Persistence | null;
  /** Auto-resume. */
  readonly resume: Resume;
  readonly #defaults: PlayerDefaults;
  readonly #store: PlayerStore;
  readonly #tap: (name: string, args: readonly unknown[]) => void;
  #userId: string | undefined;
  #unlisten: (() => void) | null;
  #connecting: Promise<void> | null = null;

  /**
   * Creates the client. Nothing connects until `connect()`.
   *
   * @param options - Adapter, nodes and settings.
   * @throws {ValidationError} When an option is invalid.
   */
  constructor(options: LunalinkOptions) {
    super();
    this.#defaults = checkOptions(options);
    this.options = options;
    this.#store = options.store ?? new MemoryStore();
    this.setListenerErrorHandler((error, name) => {
      this.#debug("error", `A ${name} listener threw`, { error: String(error) });
    });
    const debug = (event: DebugEvent): void => {
      this.emit("debug", event);
    };
    this.nodes = new NodeManager(
      {
        userId: () => this.clientId,
        clientName: options.clientName ?? CLIENT_NAME,
        socketFactory: options.socketFactory ?? builtInSocketFactory,
        fetch: options.fetch,
        capabilityRules: () => this.plugins.capabilityRules.items(),
        debug,
      },
      options.nodeSelection,
    );
    this.plugins = new PluginHost(
      {
        search: (input) => this.#search(input),
        getPlayer: (guildId) => this.players.get(guildId),
        listPlayers: () => this.players.list(),
        listNodes: () => this.nodes.list(),
        on: (name, listener) => this.on(name, listener),
        emitCustom: (name, args) => {
          this.#dispatch(name, args);
        },
        addAutoplayStrategy: (strategy, position) => this.autoplay.addStrategy(strategy, position),
        store: () => this.store,
        debug,
      },
      (plugin, label, error) => {
        this.#debug("warn", `Plugin "${plugin}" failed in ${label}`, { error: String(error) });
        this.#dispatch("pluginError", [plugin, label, error]);
      },
      options.pluginOptions,
    );
    this.autoplay = new Autoplay(
      { trackFactory: (api, requester) => this.#trackFactory()(api, requester), debug },
      options.autoplay,
    );
    this.players = new PlayerManager(
      this.nodes,
      createPlayerRuntime({
        adapter: options.adapter,
        clientId: () => this.clientId,
        nodes: this.nodes,
        plugins: () => this.plugins,
        autoplay: () => this.autoplay,
        voiceStates: this.voiceStates,
        queueProvider: () => this.plugins.slots.get("queue") ?? options.structures?.queue,
        getPlayer: (guildId) => this.players.get(guildId),
        defaults: this.#defaults,
        emit: (name, args) => {
          this.#tap(name, args);
          this.#dispatch(name, args);
        },
        resolve: (item, player) =>
          mirrorTrack(player.node, item, this.plugins.slots.get("mirrorMatcher") ?? pickBestMatch),
        debug,
      }),
      options.structures?.player,
    );
    this.autoLeave = new AutoLeave(
      {
        clientId: () => this.clientId,
        voiceStates: this.voiceStates,
        getPlayer: (guildId) => this.players.get(guildId),
        debug,
      },
      options.autoLeave,
    );
    this.failover = new Failover(
      { nodes: this.nodes, playersOn: (node) => this.players.on(node), debug },
      options.failover,
    );
    const resumeOn = options.resume?.enabled !== false;
    this.persistence = resumeOn
      ? new Persistence(
          { store: this.#storeView(), players: () => this.players.list(), debug },
          options.resume,
        )
      : null;
    this.resume = new Resume(
      {
        nodes: this.nodes,
        players: this.players,
        persistence: this.persistence,
        trackFactory: (api, requester) => this.#trackFactory()(api, requester),
        hasListeners: (player) => this.autoLeave.hasListeners(player),
        onHold: (player) => {
          this.autoLeave.onVoiceState(player.guildId);
        },
        emitResumed: (player, info) => {
          this.#dispatch("playerResumed", [player, info]);
        },
        debug,
      },
      { ...options.resume, enabled: resumeOn },
    );
    this.#tap = createLifecycleTap({
      autoplay: this.autoplay,
      autoLeave: this.autoLeave,
      persistence: this.persistence,
      hooks: this.plugins.hooks,
    });
    this.#wireNodes();
    this.plugins.slots.onChange(() => {
      this.#applySlots();
    });
    this.#unlisten = options.adapter.listen((packet) => {
      this.handleRaw(packet);
    });
  }

  /**
   * The bot's user id, from the adapter or the `READY` packet.
   *
   * @returns The id, or `undefined` before login.
   */
  get clientId(): string | undefined {
    return this.options.adapter.clientId() ?? this.#userId;
  }

  /**
   * The store in use: a plugin's, yours, or the built-in memory store.
   *
   * @returns The store.
   */
  get store(): PlayerStore {
    return this.plugins.slots.get("store") ?? this.#store;
  }

  /**
   * Installs plugins, connects every node and restores saved players. Call it once the bot is
   * logged in. Calling it again returns the same promise.
   *
   * @returns Resolves once every node was tried.
   */
  connect(): Promise<void> {
    this.#connecting ??= this.#connect();
    return this.#connecting;
  }

  /**
   * Searches for tracks: plugin resolvers first, then the node.
   *
   * @param query - Text or a link.
   * @param options - Platform, requester and node.
   * @returns The result. Plugin resolvers can return unresolved tracks; check `kind` when it
   *   matters.
   */
  search(
    query: string,
    options: Omit<SearchInput, "query"> = {},
  ): Promise<SearchResult<QueueItem>> {
    return this.#search({ ...options, query });
  }

  /**
   * Feeds a raw gateway packet to Lunalink. Adapters call this; call it yourself only with a
   * custom adapter that doesn't use `listen`.
   *
   * @param packet - The packet.
   */
  handleRaw(packet: GatewayPacket): void {
    routeRawPacket(packet, {
      voiceState: (data) => {
        this.voiceStates.handleVoiceState(data);
        this.players.handleVoiceState(data);
        if (data.guild_id) this.autoLeave.onVoiceState(data.guild_id);
      },
      voiceServer: (data) => {
        this.players.handleVoiceServer(data).catch((error: unknown) => {
          this.#debug("warn", "Handling a voice server update failed", { error: String(error) });
        });
      },
      guildCreate: (data) => {
        this.voiceStates.handleGuildCreate(data);
      },
      guildDelete: (guildId) => {
        this.voiceStates.forgetGuild(guildId);
      },
      ready: (userId) => {
        this.#userId = userId;
      },
    });
  }

  /**
   * Stops Lunalink: players, timers, plugins and node connections.
   *
   * @param options - `destroy` (default) or `pause` for a planned restart.
   */
  async shutdown(options: ShutdownOptions = {}): Promise<void> {
    const players = this.players.list();
    if (options.mode === "pause") {
      const playing = players.filter((player) => player.playing);
      await Promise.allSettled(playing.map((player) => player.pause()));
      await this.persistence?.markPausedForRestart(playing.map((player) => player.guildId));
      await this.persistence?.flush();
    } else {
      const persistence = this.persistence;
      if (persistence) {
        await Promise.allSettled(players.map((player) => persistence.remove(player.guildId)));
      }
    }
    this.#unlisten?.();
    this.#unlisten = null;
    this.autoLeave.dispose();
    this.failover.dispose();
    this.resume.dispose();
    this.persistence?.dispose();
    if (options.mode !== "pause") await this.players.destroyAll("shutdown");
    await this.plugins.destroy();
    this.nodes.destroyAll();
    await Promise.resolve(this.store.close?.()).catch(() => undefined);
  }

  async #connect(): Promise<void> {
    for (const plugin of this.options.plugins ?? []) await this.plugins.add(plugin);
    await this.plugins.start();
    this.#applySlots();
    const sessions = await this.resume.savedSessions();
    this.options.nodes.forEach((node, index) => {
      const field = `nodes[${String(index)}]`;
      const id = resolveNodeOptions(node, field).id;
      const sessionId = node.sessionId ?? sessions.get(id);
      this.nodes.add(sessionId === undefined ? node : { ...node, sessionId }, field);
    });
    const results = await this.nodes.connectAll();
    if (results.every((result) => result.status === "rejected")) {
      this.#debug("error", "No node could connect. Check host, port and password.");
    }
    this.persistence?.start();
    await this.resume.restoreSaved();
  }

  #search(input: SearchInput): Promise<SearchResult<QueueItem>> {
    return runSearch(
      {
        hooks: this.plugins.hooks,
        resolvePlugins: (search) => this.plugins.resolve(search),
        searchNode: (nodeId) =>
          nodeId === undefined
            ? this.nodes.select({ guildId: "search", region: null, exclude: new Set() })
            : this.nodes.require(nodeId),
        trackFactory: () => this.#trackFactory(),
        defaultSource: this.options.defaultSearchSource ?? "youtube",
        linkRules: this.options.linkRules ?? {},
      },
      input,
    );
  }

  #wireNodes(): void {
    const events = this.nodes.events;
    for (const name of NODE_EVENTS) {
      events.on(name, (...args: unknown[]) => {
        this.#dispatch(name, args);
      });
    }
    events.on("nodeEvent", (node, event) => {
      this.players.handleNodeEvent(node, event);
      if (event.type === "unknown")
        this.#mapUnknown(node, event.guildId, event.name, event.payload);
    });
    events.on("nodePlayerUpdate", (node, guildId, state) => {
      this.players.handlePlayerUpdate(node, guildId, state);
    });
  }

  #mapUnknown(node: Node, guildId: string, type: string, payload: ApiEventBase): void {
    const player = this.players.get(guildId);
    for (const { owner, item } of this.plugins.mappers.entries()) {
      if (item.type !== type) continue;
      try {
        const mapped = item.mapper(payload, player?.node === node ? player : undefined);
        if (mapped) this.#dispatch(mapped.name, mapped.args);
      } catch (error) {
        this.#dispatch("pluginError", [owner, `mapper ${type}`, error]);
      }
    }
  }

  #applySlots(): void {
    const slots = this.plugins.slots;
    this.players.setPlayerClass(slots.get("player") ?? this.options.structures?.player);
    this.nodes.setSelector(slots.get("nodeSelector") ?? this.options.nodeSelection ?? "leastLoad");
  }

  #trackFactory(): TrackFactory {
    return (
      this.plugins.slots.get("trackFactory") ??
      this.options.structures?.trackFactory ??
      defaultTrackFactory
    );
  }

  #storeView(): PlayerStore {
    return {
      get: (key) => this.store.get(key),
      set: (key, value) => this.store.set(key, value),
      delete: (key) => this.store.delete(key),
      keys: (prefix) => this.store.keys(prefix),
    };
  }

  #dispatch(name: string, args: readonly unknown[]): void {
    const deliver = this.emit.bind(this) as (event: string, ...rest: unknown[]) => boolean;
    this.plugins.bus.dispatch(name, args, () => {
      deliver(name, ...args);
    });
  }

  #debug(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
    this.emit("debug", { scope: "lunalink", level, message, ...(data ? { data } : {}) });
  }
}
