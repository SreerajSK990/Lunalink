import type { NodeEvent } from "../drivers/types.js";
import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import { ValidationError } from "../errors/ValidationError.js";
import type { Node } from "../node/Node.js";
import type { NodeManager } from "../node/NodeManager.js";
import type { ApiPlayerState } from "../protocol/index.js";
import { isSnowflake } from "../utils/guards.js";
import type { VoiceServerData, VoiceStateData } from "../voice/gatewayTypes.js";
import { parseVoiceRegion } from "../voice/regions.js";
import { Player } from "./Player.js";
import type { PlayerRuntime } from "./PlayerRuntime.js";
import type { DestroyReason, PlayerOptions } from "./types.js";

/**
 * A `Player` subclass constructor. Pass one as `structures.player` to add your own methods.
 */
export type PlayerClass = new (
  options: PlayerOptions,
  node: Node,
  runtime: PlayerRuntime<Player>,
) => Player;

/**
 * Holds every player, creates new ones, and routes node events and Discord voice packets to the
 * right player. Available as `lunalink.players`.
 */
export class PlayerManager {
  readonly #players = new Map<string, Player>();
  readonly #nodes: NodeManager;
  readonly #runtime: PlayerRuntime<Player>;
  #playerClass: PlayerClass;
  readonly #played = new Set<string>();

  /**
   * Creates the manager.
   *
   * @param nodes - The node manager.
   * @param runtime - Services for players. Its `onDestroyed` is wrapped so the manager forgets
   *   destroyed players.
   * @param playerClass - Player class to construct.
   */
  constructor(
    nodes: NodeManager,
    runtime: PlayerRuntime<Player>,
    playerClass: PlayerClass = Player,
  ) {
    this.#nodes = nodes;
    this.#playerClass = playerClass;
    this.#runtime = {
      ...runtime,
      onDestroyed: (player) => {
        if (this.#players.get(player.guildId) === player) this.#players.delete(player.guildId);
        this.#played.delete(player.guildId);
        runtime.onDestroyed(player);
      },
    };
  }

  /**
   * Changes the class new players are built from. Players that already exist keep theirs.
   *
   * @param playerClass - Player class, or `undefined` for the built-in one.
   */
  setPlayerClass(playerClass: PlayerClass | undefined): void {
    this.#playerClass = playerClass ?? Player;
  }

  /**
   * Number of players.
   *
   * @returns Player count.
   */
  get size(): number {
    return this.#players.size;
  }

  /**
   * Creates a player, or returns the existing one for that guild.
   *
   * @param options - Player settings.
   * @returns The player. Call `connect()` on it to join voice.
   * @throws {ValidationError} When the ids aren't Discord ids.
   * @throws {LunalinkError} `NO_NODES_AVAILABLE` when no node is ready.
   */
  create(options: PlayerOptions): Player {
    const existing = this.#players.get(options.guildId);
    if (existing) {
      if (options.textChannelId !== undefined) existing.textChannelId = options.textChannelId;
      return existing;
    }
    if (!isSnowflake(options.guildId)) throw new ValidationError("guildId", "must be a Discord id");
    if (!isSnowflake(options.voiceChannelId))
      throw new ValidationError("voiceChannelId", "must be a Discord id");
    const node = options.nodeId
      ? this.#nodes.require(options.nodeId)
      : this.#nodes.select({ guildId: options.guildId, region: null, exclude: new Set() });
    const player = new this.#playerClass(options, node, this.#runtime);
    this.#players.set(player.guildId, player);
    this.#runtime.emit("playerCreate", player);
    return player;
  }

  /**
   * Gets a guild's player.
   *
   * @param guildId - Guild id.
   * @returns The player, or `undefined`.
   */
  get(guildId: string): Player | undefined {
    return this.#players.get(guildId);
  }

  /**
   * Gets a guild's player, or throws.
   *
   * @param guildId - Guild id.
   * @returns The player.
   * @throws {LunalinkError} `PLAYER_NOT_FOUND` when the guild has none.
   */
  require(guildId: string): Player {
    const player = this.#players.get(guildId);
    if (!player) {
      throw new LunalinkError(ErrorCode.PlayerNotFound, `There's no player for guild ${guildId}.`, {
        details: { guildId },
      });
    }
    return player;
  }

  /**
   * Checks whether a guild has a player.
   *
   * @param guildId - Guild id.
   * @returns `true` when it has one.
   */
  has(guildId: string): boolean {
    return this.#players.has(guildId);
  }

  /**
   * Lists every player.
   *
   * @returns Players.
   */
  list(): Player[] {
    return [...this.#players.values()];
  }

  /**
   * Lists the players on one node.
   *
   * @param node - The node.
   * @returns Players on it.
   */
  on(node: Node): Player[] {
    return this.list().filter((player) => player.node === node);
  }

  /**
   * Destroys a guild's player.
   *
   * @param guildId - Guild id.
   * @param reason - Why.
   * @returns `true` when there was a player.
   */
  async destroy(guildId: string, reason: DestroyReason = "manual"): Promise<boolean> {
    const player = this.#players.get(guildId);
    if (!player) return false;
    await player.destroy(reason);
    return true;
  }

  /**
   * Destroys every player.
   *
   * @param reason - Why.
   */
  async destroyAll(reason: DestroyReason = "manual"): Promise<void> {
    await Promise.allSettled(this.list().map((player) => player.destroy(reason)));
  }

  /**
   * Routes a node event to its player.
   *
   * @param node - Node that sent it.
   * @param event - The event.
   */
  handleNodeEvent(node: Node, event: NodeEvent): void {
    const player = this.#players.get(event.guildId);
    if (player?.node !== node) return;
    if (event.type === "trackStart") this.#played.add(player.guildId);
    player.handleNodeEvent(event);
  }

  /**
   * Routes a position update to its player.
   *
   * @param node - Node that sent it.
   * @param guildId - Guild id.
   * @param state - Live state.
   */
  handlePlayerUpdate(node: Node, guildId: string, state: ApiPlayerState): void {
    const player = this.#players.get(guildId);
    if (player?.node === node) player.handlePlayerUpdate(state);
  }

  /**
   * Routes a `VOICE_STATE_UPDATE` about the bot to its player.
   *
   * @param data - Packet data.
   */
  handleVoiceState(data: VoiceStateData): void {
    if (!data.guild_id || data.user_id !== this.#runtime.clientId()) return;
    this.#players.get(data.guild_id)?.handleVoiceState(data);
  }

  /**
   * Routes a `VOICE_SERVER_UPDATE` to its player. Before the first track, it also moves the
   * player to a node in the voice region, when your nodes have `regions` set.
   *
   * @param data - Packet data.
   */
  async handleVoiceServer(data: VoiceServerData): Promise<void> {
    const player = this.#players.get(data.guild_id);
    if (!player) return;
    const region = parseVoiceRegion(data.endpoint);
    const usesRegions = this.#nodes.list().some((node) => node.options.regions.length > 0);
    if (region && usesRegions && !this.#played.has(player.guildId) && !player.current) {
      const best = this.#nodes.select({ guildId: player.guildId, region, exclude: new Set() });
      if (
        best !== player.node &&
        best.options.regions.includes(region) &&
        !player.node.options.regions.includes(region)
      ) {
        await player.moveTo(best).catch(() => undefined);
      }
    }
    player.handleVoiceServer(data);
  }
}
