import type { Capability } from "../capabilities/Capability.js";
import type { NodeEvent } from "../drivers/types.js";
import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import { ValidationError } from "../errors/ValidationError.js";
import type { DebugLevel } from "../events/DebugEvent.js";
import { ChaptersFeature } from "../features/chapters/ChaptersFeature.js";
import { LyricsFeature } from "../features/lyrics/LyricsFeature.js";
import { NodeLinkPlayerFeatures } from "../features/nodelink/NodeLinkPlayerFeatures.js";
import { SponsorBlockFeature } from "../features/sponsorblock/SponsorBlockFeature.js";
import { FilterManager } from "../filters/FilterManager.js";
import type { Node } from "../node/Node.js";
import type { ApiPlayerState } from "../protocol/index.js";
import type { MemoryQueue } from "../queue/MemoryQueue.js";
import type { LoopMode, Queue } from "../queue/types.js";
import type { Register } from "../track/Register.js";
import type { QueueItem } from "../track/QueueItem.js";
import type { Track } from "../track/Track.js";
import { TimerRegistry } from "../utils/TimerRegistry.js";
import type { VoiceServerData, VoiceStateData } from "../voice/gatewayTypes.js";
import { VoiceBridge } from "../voice/VoiceBridge.js";
import { emitNodeEvent, voiceCallbacks } from "./playerEvents.js";
import { PlaybackFlow } from "./PlaybackFlow.js";
import type { PlayerRuntime } from "./PlayerRuntime.js";
import { PlayerUpdater } from "./PlayerUpdater.js";
import { PositionClock } from "./PositionClock.js";
import type { DestroyReason, PlaybackState, PlayerOptions, PlayOptions } from "./types.js";

/**
 * The queue type players expose: your registered queue class, or the built-in one.
 */
export type PlayerQueue = Register extends { queue: infer Q } ? Q : MemoryQueue;

/**
 * Server state handed to {@link Player.adopt}.
 */
export interface AdoptState {
  /** Position in milliseconds. */
  position: number;
  /** Whether the node has it paused. */
  paused: boolean;
  /** Volume on the node. */
  volume: number;
}

/**
 * A music player for one guild. Create one with `lunalink.players.create()`.
 *
 * @example
 * ```ts
 * const player = lunalink.players.create({ guildId, voiceChannelId });
 * await player.connect();
 * const { tracks } = await lunalink.search("lofi hip hop", { requester: user });
 * await player.queue.add(tracks[0]!);
 * await player.play();
 * ```
 */
export class Player {
  /** Guild id. */
  readonly guildId: string;
  /** Audio filters. */
  readonly filters: FilterManager;
  /** Lyrics, from NodeLink, LavaLyrics or lyrics.kt. */
  readonly lyrics: LyricsFeature;
  /** SponsorBlock, from the Lavalink plugin or NodeLink. */
  readonly sponsorBlock: SponsorBlockFeature;
  /** Video chapters. */
  readonly chapters: ChaptersFeature;
  /** NodeLink-only features: mixer, crossfade, fades, voice receive and more. */
  readonly nodelink: NodeLinkPlayerFeatures;
  /** Free storage for your own per-player values. */
  readonly data: Map<string, unknown> = new Map();
  /** Voice connection details. */
  readonly voice: VoiceBridge;
  /** Text channel id you set, for sending messages. */
  textChannelId: string | null;

  readonly #queue: Queue;
  readonly #runtime: PlayerRuntime<Player>;
  readonly #timers = new TimerRegistry();
  readonly #clock = new PositionClock();
  readonly #updater: PlayerUpdater;
  readonly #flow: PlaybackFlow;
  #node: Node;
  #state: PlaybackState = "idle";
  #current: Track | null = null;
  #volume: number;
  #loop: LoopMode;
  #autoplay: boolean;
  #lock: Promise<unknown> = Promise.resolve();

  /**
   * Creates a player. Use `lunalink.players.create()` instead of calling this yourself.
   *
   * @param options - Player settings.
   * @param node - Node to start on.
   * @param runtime - Services from Lunalink.
   */
  constructor(options: PlayerOptions, node: Node, runtime: PlayerRuntime<Player>) {
    this.guildId = options.guildId;
    this.textChannelId = options.textChannelId ?? null;
    this.#runtime = runtime;
    this.#node = node;
    this.#volume = options.volume ?? runtime.defaults.volume;
    this.#loop = options.loop ?? "off";
    this.#autoplay = options.autoplay ?? runtime.defaults.autoplay;
    this.#updater = new PlayerUpdater(this.guildId, () => this.#node);
    this.#queue = runtime.queueProvider({
      guildId: this.guildId,
      emitChange: (change) => {
        runtime.emit("queueUpdate", this, change);
        if (change.type !== "advance" && change.type !== "setCurrent")
          void this.#flow.syncGapless();
      },
    });
    const featureHost = {
      guildId: this.guildId,
      node: () => this.#node,
      currentTrack: () => this.#current,
      update: async (body: Parameters<PlayerUpdater["update"]>[0]) => {
        await this.#updater.update(body);
      },
    };
    this.lyrics = new LyricsFeature(featureHost);
    this.sponsorBlock = new SponsorBlockFeature(featureHost);
    this.chapters = new ChaptersFeature(featureHost);
    this.nodelink = new NodeLinkPlayerFeatures(featureHost);
    this.filters = new FilterManager({
      capabilities: () => this.#node.capabilities,
      nodeId: () => this.#node.id,
      send: async (filters) => {
        await this.#updater.update({ filters });
      },
      extraPresets: () => runtime.presets(),
    });
    this.voice = new VoiceBridge({
      guildId: this.guildId,
      send: runtime.send,
      timers: this.#timers,
      timeoutMs: runtime.defaults.voiceTimeoutMs,
      pushVoice: async (voice) => {
        await this.#updater.update({ voice });
      },
      ...voiceCallbacks(this, runtime),
    });
    this.voice.channelId = options.voiceChannelId;
    this.voice.selfDeaf = options.selfDeaf ?? true;
    this.voice.selfMute = options.selfMute ?? false;
    this.#flow = new PlaybackFlow(this.#flowHost());
  }

  /**
   * The queue. With the built-in queue every method is synchronous; with a queue from a plugin,
   * await its methods.
   *
   * @returns The queue.
   */
  get queue(): PlayerQueue {
    return this.#queue as PlayerQueue;
  }

  /**
   * The node this player is on.
   *
   * @returns The node.
   */
  get node(): Node {
    return this.#node;
  }

  /**
   * The voice channel the bot is in.
   *
   * @returns Channel id, or `null`.
   */
  get voiceChannelId(): string | null {
    return this.voice.channelId;
  }

  /**
   * The playing track.
   *
   * @returns The track, or `null`.
   */
  get current(): Track | null {
    return this.#current;
  }

  /**
   * Playback state.
   *
   * @returns `idle`, `playing`, `paused` or `destroyed`.
   */
  get state(): PlaybackState {
    return this.#state;
  }

  /**
   * Whether a track is playing and not paused.
   *
   * @returns `true` when playing.
   */
  get playing(): boolean {
    return this.#state === "playing";
  }

  /**
   * Whether playback is paused.
   *
   * @returns `true` when paused.
   */
  get paused(): boolean {
    return this.#state === "paused";
  }

  /**
   * Live position estimate in milliseconds.
   *
   * @returns The position.
   */
  get position(): number {
    return this.#current ? this.#clock.position() : 0;
  }

  /**
   * Volume, 0 to 1000.
   *
   * @returns The volume.
   */
  get volume(): number {
    return this.#volume;
  }

  /**
   * Loop mode.
   *
   * @returns `off`, `track` or `queue`.
   */
  get loop(): LoopMode {
    return this.#loop;
  }

  /**
   * Whether autoplay is on.
   *
   * @returns `true` when on.
   */
  get autoplay(): boolean {
    return this.#autoplay;
  }

  /**
   * Whether the player's node has a capability.
   *
   * @param capability - Capability to check, for example `lyrics` or `filter:echo`.
   * @returns `true` when supported.
   */
  supports(capability: Capability): boolean {
    return this.#node.supports(capability);
  }

  /**
   * Joins the voice channel from the options, or another one.
   *
   * @param voiceChannelId - Channel to join. Defaults to the current one.
   * @throws {LunalinkError} `VOICE_CONNECTION_TIMEOUT` when Discord doesn't answer in time.
   */
  async connect(voiceChannelId: string | null = this.voice.channelId): Promise<void> {
    this.#assertAlive();
    if (!voiceChannelId) throw new ValidationError("voiceChannelId", "no voice channel to join");
    await this.voice.join(voiceChannelId);
    await this.#updater.update({ volume: this.#volume });
    this.#runtime.emit("playerConnect", this);
  }

  /**
   * Plays now. With a track, it starts that track right away and the old one goes to history.
   * Without one, it starts the queue.
   *
   * @param item - Track to play now.
   * @param options - Start, end and pause.
   * @returns `true` when something started.
   */
  play(item?: QueueItem, options: PlayOptions = {}): Promise<boolean> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      if (item) {
        await this.#queue.add(item, { position: 0 });
        const entry = await this.#queue.advance("off");
        return entry ? this.#flow.start(entry, options) : false;
      }
      if (this.#current) return true;
      const entry = (await this.#queue.current()) ?? (await this.#queue.advance("off"));
      return entry ? this.#flow.start(entry, options) : false;
    });
  }

  /**
   * Skips to the next track, or several tracks ahead.
   *
   * @param count - How many tracks to skip. Defaults to 1.
   *
   * @returns Resolves once the next track started or the queue ended.
   */
  skip(count = 1): Promise<void> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      if (count > 1 && (await this.#queue.skipTo(count - 1))) {
        const entry = await this.#queue.current();
        if (entry && (await this.#flow.start(entry))) return;
      }
      await this.#flow.next("skip");
    });
  }

  /**
   * Goes back to the previous track.
   *
   * @returns `true` when there was one.
   */
  previous(): Promise<boolean> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      const entry = await this.#queue.back();
      return entry ? this.#flow.start(entry) : false;
    });
  }

  /**
   * Stops the track. The queue stays unless `clearQueue` is set.
   *
   * @param clearQueue - Also empty the queue.
   *
   * @returns Resolves once the node stopped the track.
   */
  stop(clearQueue = false): Promise<void> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      if (clearQueue) await this.#queue.clear();
      await this.#queue.setCurrent(null);
      this.#current = null;
      this.#state = "idle";
      await this.#updater.update({ track: { encoded: null } });
    });
  }

  /**
   * Pauses or resumes.
   *
   * @param paused - `true` to pause.
   */
  async setPaused(paused: boolean): Promise<void> {
    this.#assertAlive();
    await this.#updater.update({ paused });
    this.#clock.setPaused(paused);
    if (this.#current) this.#state = paused ? "paused" : "playing";
  }

  /**
   * Pauses playback.
   *
   * @returns Resolves once the node paused.
   */
  pause(): Promise<void> {
    return this.setPaused(true);
  }

  /**
   * Resumes playback.
   *
   * @returns Resolves once the node resumed.
   */
  resume(): Promise<void> {
    return this.setPaused(false);
  }

  /**
   * Jumps to a position in the track.
   *
   * @param position - Position in milliseconds.
   * @throws {ValidationError} When nothing is playing or the track can't seek.
   */
  async seek(position: number): Promise<void> {
    this.#assertAlive();
    const track = this.#current;
    if (!track) throw new ValidationError("position", "nothing is playing");
    if (!track.isSeekable) throw new ValidationError("position", "this track can't be seeked");
    const target = Math.max(0, Math.min(Math.trunc(position), track.duration));
    await this.#updater.update({ position: target });
    this.#clock.set(target);
  }

  /**
   * Changes the volume.
   *
   * @param volume - 0 to 1000. 100 is normal.
   * @throws {ValidationError} When out of range.
   */
  async setVolume(volume: number): Promise<void> {
    this.#assertAlive();
    if (!Number.isFinite(volume) || volume < 0 || volume > 1000) {
      throw new ValidationError("volume", "must be between 0 and 1000");
    }
    await this.#updater.update({ volume: Math.round(volume) });
    this.#volume = Math.round(volume);
  }

  /**
   * Changes the loop mode.
   *
   * @param mode - `off`, `track` or `queue`.
   */
  setLoop(mode: LoopMode): void {
    this.#loop = mode;
    void this.#flow.syncGapless();
  }

  /**
   * Turns autoplay on or off.
   *
   * @param enabled - On or off.
   */
  setAutoplay(enabled: boolean): void {
    this.#autoplay = enabled;
  }

  /**
   * Moves the bot to another voice channel.
   *
   * @param voiceChannelId - Channel to move to.
   */
  async setVoiceChannel(voiceChannelId: string): Promise<void> {
    this.#assertAlive();
    await this.voice.join(voiceChannelId);
  }

  /**
   * Moves the player to another node and carries on from the same position.
   *
   * @param target - Node to move to.
   *
   * @returns Resolves once the new node took over.
   */
  moveTo(target: Node): Promise<void> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      if (target === this.#node) return;
      const from = this.#node;
      this.#node = target;
      await this.#push(this.position);
      if (from.connected) void this.#updater.destroy(from).catch(() => undefined);
      this.#runtime.emit("playerNodeChange", this, from.id, target.id);
    });
  }

  /**
   * Sends the whole player state to its node again: voice, the track at a position, volume,
   * pause and filters. Auto-resume uses it when the node lost the player.
   *
   * @param position - Where to continue, in milliseconds. Defaults to the current position.
   * @returns Resolves once the node took it.
   */
  resync(position: number = this.position): Promise<void> {
    return this.#exclusive(async () => {
      this.#assertAlive();
      await this.#push(position);
    });
  }

  /**
   * Takes over a player the node still has, without sending anything to the node. Auto-resume
   * uses it after a restart, when the server kept playing.
   *
   * @param track - The track the node is playing, or `null`.
   * @param state - Position, pause and volume as the node reports them.
   */
  adopt(track: Track | null, state: AdoptState): void {
    this.#assertAlive();
    this.#current = track;
    this.#volume = state.volume;
    this.#state = track ? (state.paused ? "paused" : "playing") : "idle";
    if (track) {
      this.#clock.reset(track.isStream ? 0 : track.duration, state.position, state.paused);
    }
  }

  /**
   * Leaves voice and destroys the player on the node and in Lunalink.
   *
   * @param reason - Why, passed to `playerDestroy`.
   */
  async destroy(reason: DestroyReason = "manual"): Promise<void> {
    if (this.#state === "destroyed") return;
    this.#state = "destroyed";
    this.voice.dispose();
    this.#timers.clearAll();
    const steps = [
      reason === "disconnected" ? Promise.resolve() : this.voice.leave(),
      this.#updater.destroy(),
    ];
    await Promise.allSettled(steps);
    await Promise.resolve(this.#queue.destroy?.()).catch(() => undefined);
    this.#runtime.emit("playerDestroy", this, reason);
    this.#runtime.onDestroyed(this);
  }

  /**
   * Feeds a node event to the player. Called by the player manager.
   *
   * @param event - Normalized event.
   */
  handleNodeEvent(event: NodeEvent): void {
    emitNodeEvent(this, this.#runtime, event);
    if (event.type === "voiceClosed" && event.code === 4006 && this.voice.channelId) {
      void this.connect().catch((error: unknown) => {
        this.#debug("warn", "Rejoining voice after close code 4006 failed", {
          error: String(error),
        });
      });
    }
    if (event.type === "trackException") this.#flow.markFailed(event.track.encoded);
    if (event.type === "chaptersLoaded") this.chapters.remember(event.chapters);
    void this.#exclusive(() => this.#flow.handle(event)).catch((error: unknown) => {
      this.#debug("error", "Handling a node event failed", { error: String(error) });
    });
  }

  /**
   * Feeds a position update to the player. Called by the player manager.
   *
   * @param state - Live state from the node.
   */
  handlePlayerUpdate(state: ApiPlayerState): void {
    if (this.#current) this.#clock.set(state.position);
    this.#runtime.emit("playerUpdate", this, state);
  }

  /**
   * Feeds the bot's own `VOICE_STATE_UPDATE` to the player. Called by the player manager.
   *
   * @param data - Packet data.
   */
  handleVoiceState(data: VoiceStateData): void {
    this.voice.handleStateUpdate(data);
  }

  /**
   * Feeds a `VOICE_SERVER_UPDATE` to the player. Called by the player manager.
   *
   * @param data - Packet data.
   */
  handleVoiceServer(data: VoiceServerData): void {
    this.voice.handleServerUpdate(data);
  }

  #flowHost(): ConstructorParameters<typeof PlaybackFlow>[0] {
    return {
      guildId: this.guildId,
      queue: this.#queue,
      updater: this.#updater,
      clock: this.#clock,
      defaults: this.#runtime.defaults,
      node: () => this.#node,
      loop: () => this.#loop,
      autoplay: () => this.#autoplay,
      isDestroyed: () => this.#state === "destroyed",
      setPlayback: (state) => {
        if (this.#state !== "destroyed") this.#state = state;
      },
      currentTrack: () => this.#current,
      setCurrentTrack: (track) => {
        this.#current = track;
      },
      resolve: (item) => this.#runtime.resolve(item, this),
      beforePlay: (track) => this.#runtime.beforePlay(this, track),
      onQueueEnd: (lastTrack) => this.#runtime.onQueueEnd(this, lastTrack),
      trackError: (item, info) => {
        this.#runtime.emit("trackError", this, item, info);
      },
      queueEnd: (lastTrack) => {
        this.#runtime.emit("queueEnd", this, lastTrack);
      },
      debug: (level, message, data) => {
        this.#debug(level, message, data);
      },
    };
  }

  async #push(position: number): Promise<void> {
    const voice = this.voice.credentials();
    await this.#updater.update({
      ...(voice ? { voice } : {}),
      ...(this.#current
        ? {
            track: { encoded: this.#current.encoded, userData: { ...this.#current.userData } },
            position,
          }
        : {}),
      volume: this.#volume,
      paused: this.#state === "paused",
      filters: this.filters.state,
    });
    this.#clock.set(position);
  }

  #exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#lock.then(task, task);
    this.#lock = run.catch(() => undefined);
    return run;
  }

  #assertAlive(): void {
    if (this.#state === "destroyed") {
      throw new LunalinkError(
        ErrorCode.PlayerDestroyed,
        `The player for guild ${this.guildId} was destroyed.`,
      );
    }
  }

  #debug(level: DebugLevel, message: string, data?: Record<string, unknown>): void {
    this.#runtime.debug({
      scope: `player:${this.guildId}`,
      level,
      message,
      ...(data ? { data } : {}),
    });
  }
}
