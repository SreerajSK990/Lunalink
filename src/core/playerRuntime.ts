import type { DebugEvent } from "../events/DebugEvent.js";
import type { Autoplay } from "../lifecycle/Autoplay.js";
import type { NodeManager } from "../node/NodeManager.js";
import type { Player } from "../player/Player.js";
import type { PlayerDefaults, PlayerEmit, PlayerRuntime } from "../player/PlayerRuntime.js";
import type { PluginHost } from "../plugins/PluginHost.js";
import { memoryQueueProvider } from "../queue/MemoryQueue.js";
import type { AddOptions, Queue, QueueProvider } from "../queue/types.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";
import type { VoiceStateCache } from "../voice/VoiceStateCache.js";
import type { GatewayAdapter } from "./GatewayAdapter.js";

/**
 * What the player runtime is built from.
 */
export interface PlayerRuntimeParts {
  /** The gateway adapter. */
  adapter: GatewayAdapter;
  /** Returns the bot's user id. */
  clientId(): string | undefined;
  /** Nodes. */
  nodes: NodeManager;
  /** Returns the plugin host. */
  plugins(): PluginHost;
  /** Returns autoplay. */
  autoplay(): Autoplay;
  /** Voice states. */
  voiceStates: VoiceStateCache;
  /** Returns the queue provider to use, or `undefined` for the built-in one. */
  queueProvider(): QueueProvider | undefined;
  /**
   * Gets a guild's player.
   *
   * @param guildId - Guild id.
   * @returns The player.
   */
  getPlayer(guildId: string): Player | undefined;
  /** Player defaults. */
  defaults: PlayerDefaults;
  /**
   * Emits a player event.
   *
   * @param name - Event name.
   * @param args - Arguments.
   */
  emit(name: string, args: readonly unknown[]): void;
  /**
   * Turns an unresolved track into a playable one.
   *
   * @param item - The unresolved track.
   * @param player - The player.
   * @returns The playable track.
   */
  resolve(item: UnresolvedTrack, player: Player): Promise<Track>;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

/**
 * Builds the services every player gets.
 *
 * @param parts - What it's built from.
 * @returns The runtime.
 */
export function createPlayerRuntime(parts: PlayerRuntimeParts): PlayerRuntime<Player> {
  const emit: PlayerEmit<Player> = (name, ...args) => {
    parts.emit(name, args);
  };
  return {
    clientId: () => parts.clientId(),
    send: (guildId, payload) => parts.adapter.send(guildId, payload),
    selectNode: (context) => parts.nodes.select(context),
    getNode: (id) => parts.nodes.require(id),
    emit,
    resolve: (item, player) => parts.resolve(item, player),
    beforePlay: (player, track) => parts.plugins().hooks.beforePlay(player, track),
    onQueueEnd: (player, lastTrack) => parts.autoplay().run(player, lastTrack),
    queueProvider: (context) => {
      const queue = (parts.queueProvider() ?? memoryQueueProvider)(context);
      return withQueueHook(
        queue,
        () => parts.getPlayer(context.guildId),
        () => parts.plugins(),
      );
    },
    presets: () => parts.plugins().presets.items(),
    voiceStates: parts.voiceStates,
    defaults: parts.defaults,
    debug: (event) => {
      parts.debug(event);
    },
    onDestroyed: () => undefined,
  };
}

function withQueueHook(
  queue: Queue,
  player: () => Player | undefined,
  plugins: () => PluginHost,
): Queue {
  const add = queue.add.bind(queue);
  queue.add = (items: QueueItem | readonly QueueItem[], options?: AddOptions) => {
    const owner = player();
    if (!owner) return add(items, options);
    const list: readonly QueueItem[] = isList(items) ? items : [items];
    return add(plugins().hooks.beforeQueueAdd(owner, list), options);
  };
  return queue;
}

function isList(items: QueueItem | readonly QueueItem[]): items is readonly QueueItem[] {
  return Array.isArray(items);
}
