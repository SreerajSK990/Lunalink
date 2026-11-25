import type { DebugEvent } from "../events/DebugEvent.js";
import type { FilterPreset } from "../filters/types.js";
import type { Node } from "../node/Node.js";
import type { NodeSelectionContext } from "../node/selection/strategies.js";
import type { QueueProvider } from "../queue/types.js";
import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";
import type { GatewaySender } from "../voice/gatewayTypes.js";
import type { VoiceStateCache } from "../voice/VoiceStateCache.js";
import type { PlayerEventMap } from "./types.js";

/**
 * Emits a player event on the Lunalink instance.
 */
export type PlayerEmit<P> = <Name extends keyof PlayerEventMap<P>>(
  name: Name,
  ...args: PlayerEventMap<P>[Name]
) => void;

/**
 * Defaults every player starts with.
 */
export interface PlayerDefaults {
  /** Volume, 0 to 1000. */
  volume: number;
  /** Autoplay on or off. */
  autoplay: boolean;
  /** Skip a track that gets stuck. */
  skipOnStuck: boolean;
  /** Stop after this many tracks fail in a row. */
  maxConsecutiveErrors: number;
  /** Hand the next track to NodeLink early so it starts without a gap. */
  gapless: boolean;
  /** How long to wait for Discord's voice packets, in milliseconds. */
  voiceTimeoutMs: number;
}

/**
 * Everything a player needs from the Lunalink instance. Kept as an interface so players can be
 * tested on their own and so the player layer never imports the core.
 */
export interface PlayerRuntime<P> {
  /** Returns the bot's user id. */
  clientId(): string | undefined;
  /** Sends opcode 4 to Discord. */
  send: GatewaySender;
  /**
   * Picks a node for a player.
   *
   * @param context - Guild, region and nodes to skip.
   * @returns The node.
   */
  selectNode(context: NodeSelectionContext): Node;
  /**
   * Gets a node by id.
   *
   * @param id - Node id.
   * @returns The node.
   */
  getNode(id: string): Node;
  /** Emits player events. */
  emit: PlayerEmit<P>;
  /**
   * Turns an unresolved track into a playable one: plugin resolvers first, then the mirror.
   *
   * @param item - The unresolved track.
   * @param player - The player that will play it.
   * @returns The playable track.
   */
  resolve(item: UnresolvedTrack, player: P): Promise<Track>;
  /**
   * Lets plugins change or cancel a track right before it plays.
   *
   * @param player - The player.
   * @param track - The track about to play.
   * @returns The track to play, or `null` to skip it.
   */
  beforePlay(player: P, track: Track): Promise<Track | null>;
  /**
   * Called when the queue runs out. Autoplay lives here.
   *
   * @param player - The player.
   * @param lastTrack - The track that just finished.
   * @returns `true` when something was added to the queue.
   */
  onQueueEnd(player: P, lastTrack: Track | null): Promise<boolean>;
  /** Creates the player's queue. */
  queueProvider: QueueProvider;
  /** Presets added by plugins. */
  presets(): readonly FilterPreset[];
  /** Who sits in which voice channel. */
  voiceStates: VoiceStateCache;
  /** Player defaults. */
  defaults: PlayerDefaults;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
  /**
   * Called once a player is destroyed, so the manager can forget it.
   *
   * @param player - The destroyed player.
   */
  onDestroyed(player: P): void;
}
