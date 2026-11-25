import type { DebugEvent } from "../events/DebugEvent.js";
import type { Player } from "../player/Player.js";
import { toSearchResult, type TrackFactory } from "../track/toSearchResult.js";
import type { Track } from "../track/Track.js";
import { type AutoplayStrategy, defaultAutoplayStrategies } from "./autoplayStrategies.js";

/**
 * Autoplay settings.
 */
export interface AutoplayOptions {
  /** Strategies to try, in order. Defaults to {@link defaultAutoplayStrategies}. */
  strategies?: readonly AutoplayStrategy[];
  /** How many related tracks to queue at once. Defaults to 1. */
  batchSize?: number;
  /** How many recently played tracks to avoid repeating. Defaults to 25. */
  historySize?: number;
}

/**
 * What autoplay needs from the Lunalink instance.
 */
export interface AutoplayHost {
  /** Builds tracks from node results. */
  trackFactory: TrackFactory;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
}

/**
 * Queues related tracks when a player's queue runs out. Wired into `PlayerRuntime.onQueueEnd`.
 */
export class Autoplay {
  readonly #host: AutoplayHost;
  readonly #strategies: AutoplayStrategy[];
  readonly #batchSize: number;
  readonly #historySize: number;
  readonly #recent = new Map<string, string[]>();

  /**
   * Creates the autoplay runner.
   *
   * @param host - Track factory and debug output.
   * @param options - Settings.
   */
  constructor(host: AutoplayHost, options: AutoplayOptions = {}) {
    this.#host = host;
    this.#strategies = [...(options.strategies ?? defaultAutoplayStrategies)];
    this.#batchSize = Math.max(1, options.batchSize ?? 1);
    this.#historySize = Math.max(1, options.historySize ?? 25);
  }

  /**
   * Adds a strategy. Plugins use this to add sources the server doesn't recommend for.
   *
   * @param strategy - The strategy.
   * @param position - `"first"` to try it before the others, `"last"` (default) after them.
   * @returns A function that removes it again.
   */
  addStrategy(strategy: AutoplayStrategy, position: "first" | "last" = "last"): () => void {
    if (position === "first") this.#strategies.unshift(strategy);
    else this.#strategies.push(strategy);
    return () => {
      const index = this.#strategies.indexOf(strategy);
      if (index !== -1) this.#strategies.splice(index, 1);
    };
  }

  /**
   * Remembers a track as played, so autoplay won't pick it again soon.
   *
   * @param guildId - Guild id.
   * @param track - The track that started.
   */
  remember(guildId: string, track: Track): void {
    const list = this.#recent.get(guildId) ?? [];
    list.push(track.identifier);
    if (list.length > this.#historySize) list.splice(0, list.length - this.#historySize);
    this.#recent.set(guildId, list);
  }

  /**
   * Forgets a guild's history, for example when its player is destroyed.
   *
   * @param guildId - Guild id.
   */
  forget(guildId: string): void {
    this.#recent.delete(guildId);
  }

  /**
   * Runs the strategy chain and queues what it finds.
   *
   * @param player - The player whose queue ran out.
   * @param lastTrack - The track that finished.
   * @returns `true` when something was queued.
   */
  async run(player: Player, lastTrack: Track | null): Promise<boolean> {
    if (!lastTrack) return false;
    const recent = new Set(this.#recent.get(player.guildId) ?? []);
    recent.add(lastTrack.identifier);
    for (const strategy of this.#strategies) {
      const identifiers = strategy.identifiers({ lastTrack, node: player.node });
      if (!identifiers) {
        this.#debug(player, "trace", `Autoplay strategy ${strategy.name} doesn't apply`);
        continue;
      }
      for (const identifier of identifiers) {
        const picked = await this.#load(player, identifier, lastTrack, recent);
        if (picked.length === 0) continue;
        await Promise.resolve(player.queue.add(picked));
        this.#debug(player, "info", `Autoplay queued ${picked.length} track(s)`, {
          strategy: strategy.name,
        });
        return true;
      }
    }
    this.#debug(player, "info", "Autoplay found nothing");
    return false;
  }

  async #load(
    player: Player,
    identifier: string,
    lastTrack: Track,
    recent: ReadonlySet<string>,
  ): Promise<Track[]> {
    const node = player.node;
    try {
      const result = toSearchResult(
        await node.rest.loadTracks(identifier),
        node.id,
        lastTrack.requester,
        this.#host.trackFactory,
      );
      return result.tracks
        .filter((track) => !recent.has(track.identifier) && !track.isStream)
        .slice(0, this.#batchSize);
    } catch (error) {
      this.#debug(player, "warn", "Autoplay lookup failed", {
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  #debug(
    player: Player,
    level: DebugEvent["level"],
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.#host.debug({
      scope: `autoplay:${player.guildId}`,
      level,
      message,
      ...(data ? { data } : {}),
    });
  }
}
