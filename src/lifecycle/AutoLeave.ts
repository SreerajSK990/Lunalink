import type { DebugEvent } from "../events/DebugEvent.js";
import type { Player } from "../player/Player.js";
import type { VoiceStateCache } from "../voice/VoiceStateCache.js";

/**
 * Auto-leave settings. Both timers are off unless you set them.
 */
export interface AutoLeaveOptions {
  /** Leave this long after the queue ran out, in milliseconds. `null` turns it off. */
  emptyQueueMs?: number | null;
  /** Leave this long after the last listener left the channel, in milliseconds. `null` turns it off. */
  emptyChannelMs?: number | null;
}

/**
 * What auto-leave needs from the Lunalink instance.
 */
export interface AutoLeaveHost {
  /** Returns the bot's user id. */
  clientId(): string | undefined;
  /** Who sits in which voice channel. */
  voiceStates: VoiceStateCache;
  /**
   * Gets a guild's player.
   *
   * @param guildId - Guild id.
   * @returns The player, or `undefined`.
   */
  getPlayer(guildId: string): Player | undefined;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

type TimerKind = "queue" | "channel";

/**
 * Destroys players that sit idle: after the queue ran out, or after everyone left the voice
 * channel. A timer is cancelled as soon as music or a listener comes back.
 */
export class AutoLeave {
  readonly #host: AutoLeaveHost;
  readonly #emptyQueueMs: number | null;
  readonly #emptyChannelMs: number | null;
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Creates the auto-leave watcher.
   *
   * @param host - Player lookup and voice states.
   * @param options - Timer lengths.
   */
  constructor(host: AutoLeaveHost, options: AutoLeaveOptions = {}) {
    this.#host = host;
    this.#emptyQueueMs = options.emptyQueueMs ?? null;
    this.#emptyChannelMs = options.emptyChannelMs ?? null;
  }

  /**
   * Checks whether the channel the player sits in has anyone but bots.
   *
   * @param player - The player.
   * @returns `true` when at least one person is listening, or when it can't tell.
   */
  hasListeners(player: Player): boolean {
    const channelId = player.voiceChannelId;
    const self = this.#host.clientId();
    if (!channelId || !self) return true;
    return this.#host.voiceStates.listeners(player.guildId, channelId, self) > 0;
  }

  /**
   * Starts the empty-queue timer. Call it on `queueEnd`.
   *
   * @param player - The player whose queue ran out.
   */
  onQueueEnd(player: Player): void {
    if (this.#emptyQueueMs !== null) this.#start(player.guildId, "queue", this.#emptyQueueMs);
  }

  /**
   * Cancels the empty-queue timer. Call it on `trackStart`.
   *
   * @param player - The player that started a track.
   */
  onTrackStart(player: Player): void {
    this.#cancel(player.guildId, "queue");
  }

  /**
   * Re-checks the channel after a voice state changed in a guild.
   *
   * @param guildId - Guild the change happened in.
   */
  onVoiceState(guildId: string): void {
    const player = this.#host.getPlayer(guildId);
    if (!player || this.#emptyChannelMs === null) return;
    if (this.hasListeners(player)) this.#cancel(guildId, "channel");
    else this.#start(guildId, "channel", this.#emptyChannelMs);
  }

  /**
   * Drops every timer for a guild. Call it when its player is destroyed.
   *
   * @param guildId - Guild id.
   */
  forget(guildId: string): void {
    this.#cancel(guildId, "queue");
    this.#cancel(guildId, "channel");
  }

  /**
   * Drops every timer.
   */
  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }

  #start(guildId: string, kind: TimerKind, delayMs: number): void {
    const key = `${kind}:${guildId}`;
    if (this.#timers.has(key)) return;
    const timer = setTimeout(() => {
      this.#timers.delete(key);
      void this.#leave(guildId, kind);
    }, delayMs);
    timer.unref();
    this.#timers.set(key, timer);
  }

  #cancel(guildId: string, kind: TimerKind): void {
    const key = `${kind}:${guildId}`;
    const timer = this.#timers.get(key);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#timers.delete(key);
  }

  async #leave(guildId: string, kind: TimerKind): Promise<void> {
    const player = this.#host.getPlayer(guildId);
    if (!player) return;
    if (kind === "queue" && player.current) return;
    if (kind === "channel" && this.hasListeners(player)) return;
    this.#host.debug({
      scope: `player:${guildId}`,
      level: "info",
      message:
        kind === "queue" ? "Leaving: the queue stayed empty" : "Leaving: nobody is listening",
    });
    this.forget(guildId);
    await player.destroy("autoLeave").catch(() => undefined);
  }
}
