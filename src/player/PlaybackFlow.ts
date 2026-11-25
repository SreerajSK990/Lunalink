import type { NodeEvent } from "../drivers/types.js";
import type { DebugLevel } from "../events/DebugEvent.js";
import type { Node } from "../node/Node.js";
import type { ApiNodeLinkUpdatePlayer } from "../protocol/index.js";
import type { LoopMode, Queue, QueueEntry } from "../queue/types.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { Track } from "../track/Track.js";
import type { UnresolvedTrack } from "../track/UnresolvedTrack.js";
import type { PlayerDefaults } from "./PlayerRuntime.js";
import type { PlayerUpdater } from "./PlayerUpdater.js";
import type { PositionClock } from "./PositionClock.js";
import type { PlaybackState, PlayOptions, TrackErrorInfo } from "./types.js";

/**
 * What the playback flow needs from its player.
 */
export interface FlowHost {
  /** Guild id. */
  readonly guildId: string;
  /** The player's queue, through the async-capable contract. */
  readonly queue: Queue;
  /** Sends updates to the node in order. */
  readonly updater: PlayerUpdater;
  /** Position estimate. */
  readonly clock: PositionClock;
  /** Player defaults. */
  readonly defaults: PlayerDefaults;
  /** Returns the current node. */
  node(): Node;
  /** Returns the loop mode. */
  loop(): LoopMode;
  /** Returns whether autoplay is on. */
  autoplay(): boolean;
  /** Returns whether the player was destroyed. */
  isDestroyed(): boolean;
  /** Sets the playback state. */
  setPlayback(state: PlaybackState): void;
  /** Returns the playing track. */
  currentTrack(): Track | null;
  /** Sets the playing track. */
  setCurrentTrack(track: Track | null): void;
  /** Resolves an unresolved track. */
  resolve(item: UnresolvedTrack): Promise<Track>;
  /** Lets plugins change or cancel a track before it plays. */
  beforePlay(track: Track): Promise<Track | null>;
  /** Runs autoplay; resolves `true` when it queued something. */
  onQueueEnd(lastTrack: Track | null): Promise<boolean>;
  /** Reports a failed track. */
  trackError(item: QueueItem, info: TrackErrorInfo): void;
  /** Reports that the queue ran out. */
  queueEnd(lastTrack: Track | null): void;
  /** Logs a debug message. */
  debug(level: DebugLevel, message: string, data?: Record<string, unknown>): void;
}

/**
 * Decides what plays next. It starts tracks, reacts to track end events, runs autoplay when the
 * queue is empty, and keeps NodeLink's gapless `nextTrack` in sync with the queue.
 */
export class PlaybackFlow {
  readonly #host: FlowHost;
  #failures = 0;
  #lastFailedEncoded: string | null = null;
  #gaplessEncoded: string | null = null;

  /**
   * Creates the flow.
   *
   * @param host - The owning player.
   */
  constructor(host: FlowHost) {
    this.#host = host;
  }

  /**
   * Starts a queue entry: resolves it if needed, lets plugins change it, then tells the node.
   *
   * @param entry - Entry to play. It must already be the queue's current entry.
   * @param options - Start, end, pause and language.
   * @returns `true` when the node accepted the track.
   */
  async start(entry: QueueEntry, options: PlayOptions = {}): Promise<boolean> {
    const track = await this.#prepare(entry);
    if (!track || this.#host.isDestroyed()) return false;
    const body: ApiNodeLinkUpdatePlayer = {
      track: { encoded: track.encoded, userData: { ...track.userData } },
    };
    if (options.startTime !== undefined) body.position = options.startTime;
    if (options.endTime !== undefined) body.endTime = options.endTime;
    if (options.paused !== undefined) body.paused = options.paused;
    if (options.language !== undefined && body.track) body.track.language = options.language;
    try {
      await this.#host.updater.update(body);
    } catch (error) {
      this.#host.trackError(track, {
        kind: "loadFailed",
        message: describe(error),
        exception: null,
        cause: error,
      });
      return false;
    }
    this.#gaplessEncoded = null;
    this.#host.setCurrentTrack(track);
    this.#host.clock.reset(
      track.isStream ? Number.POSITIVE_INFINITY : track.duration,
      options.startTime ?? 0,
      options.paused ?? false,
    );
    this.#host.setPlayback(options.paused ? "paused" : "playing");
    return true;
  }

  /**
   * Moves to the next track and plays it, skipping tracks that fail, and running autoplay when
   * the queue is empty.
   *
   * @param why - `finished` keeps the loop mode, `skip` ignores track loop.
   */
  async next(why: "finished" | "skip"): Promise<void> {
    const loop = this.#host.loop();
    let entry = await this.#host.queue.advance(why === "skip" && loop === "track" ? "off" : loop);
    for (;;) {
      if (this.#host.isDestroyed()) return;
      if (!entry) {
        const lastTrack = this.#host.currentTrack();
        if (this.#host.autoplay() && (await this.#host.onQueueEnd(lastTrack))) {
          entry = await this.#host.queue.advance("off");
          if (entry) continue;
        }
        await this.#finish(lastTrack);
        return;
      }
      if (await this.start(entry)) return;
      if (this.#tooManyFailures()) {
        this.#host.debug("warn", `Stopped after ${this.#failures} failed tracks in a row`);
        await this.#finish(this.#host.currentTrack());
        return;
      }
      entry = await this.#host.queue.advance("off");
    }
  }

  /**
   * Reacts to an event from the node for this player.
   *
   * @param event - Normalized event.
   */
  async handle(event: NodeEvent): Promise<void> {
    if (event.type === "trackStart") {
      this.#failures = 0;
      await this.syncGapless();
      return;
    }
    if (event.type === "trackStuck" && this.#host.defaults.skipOnStuck) {
      this.#host.debug("warn", "Track got stuck, skipping it");
      await this.next("skip");
      return;
    }
    if (event.type !== "trackEnd") return;
    const current = this.#host.currentTrack();
    if (current?.encoded !== event.track.encoded) return;
    if (event.handedOff) {
      await this.#followHandOff();
      return;
    }
    if (!event.mayStartNext) return;
    if (event.reason === "loadFailed" && this.#lastFailedEncoded !== current.encoded) {
      this.#host.trackError(current, {
        kind: "loadFailed",
        message: "The node couldn't load the track.",
        exception: null,
        cause: null,
      });
    }
    if (event.reason === "loadFailed") this.#failures++;
    await this.next("finished");
  }

  /**
   * Remembers that a track threw, so its following `loadFailed` end isn't reported twice.
   *
   * @param encoded - The failed track.
   */
  markFailed(encoded: string): void {
    this.#lastFailedEncoded = encoded;
  }

  /**
   * Tells NodeLink which track comes next, so it can start without a gap. Does nothing on
   * Lavalink, with gapless off, or when the next track isn't resolved yet.
   */
  async syncGapless(): Promise<void> {
    const node = this.#host.node();
    if (
      !this.#host.defaults.gapless ||
      !node.supports("nodelink:gapless") ||
      this.#host.isDestroyed()
    )
      return;
    const loop = this.#host.loop();
    const upcoming = await this.#host.queue.upcoming();
    const next = loop === "track" ? this.#host.currentTrack() : (upcoming[0]?.item ?? null);
    const encoded = next?.kind === "track" ? next.encoded : null;
    if (encoded === this.#gaplessEncoded) return;
    this.#gaplessEncoded = encoded;
    try {
      await this.#host.updater.update({ nextTrack: encoded ? { encoded } : null });
    } catch (error) {
      this.#host.debug("warn", "Couldn't update NodeLink's next track", { error: describe(error) });
    }
  }

  async #followHandOff(): Promise<void> {
    const handedTo = this.#gaplessEncoded;
    this.#gaplessEncoded = null;
    const entry = await this.#host.queue.advance(this.#host.loop());
    if (!entry) {
      await this.#finish(this.#host.currentTrack());
      return;
    }
    if (entry.item.kind === "track" && entry.item.encoded === handedTo) {
      this.#host.setCurrentTrack(entry.item);
      this.#host.clock.reset(entry.item.duration);
      return;
    }
    this.#host.debug(
      "info",
      "Queue changed after NodeLink took the next track, starting the queue's track",
    );
    if (!(await this.start(entry))) await this.next("finished");
  }

  async #prepare(entry: QueueEntry): Promise<Track | null> {
    let track: Track;
    if (entry.item.kind === "unresolved") {
      try {
        track = await this.#host.resolve(entry.item);
      } catch (error) {
        this.#host.trackError(entry.item, {
          kind: "resolveFailed",
          message: describe(error),
          exception: null,
          cause: error,
        });
        return null;
      }
      await this.#host.queue.setCurrent({ ...entry, item: track });
    } else {
      track = entry.item;
    }
    const approved = await this.#host.beforePlay(track);
    if (!approved) this.#host.debug("info", "A plugin skipped this track", { title: track.title });
    return approved;
  }

  async #finish(lastTrack: Track | null): Promise<void> {
    this.#host.setCurrentTrack(null);
    this.#host.setPlayback("idle");
    if (lastTrack) {
      try {
        await this.#host.updater.update({ track: { encoded: null } });
      } catch (error) {
        this.#host.debug("warn", "Couldn't stop the track on the node", { error: describe(error) });
      }
    }
    this.#host.queueEnd(lastTrack);
  }

  #tooManyFailures(): boolean {
    this.#failures++;
    return this.#failures >= this.#host.defaults.maxConsecutiveErrors;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
