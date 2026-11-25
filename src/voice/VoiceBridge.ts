import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import type { ApiVoiceState } from "../protocol/index.js";
import type { TimerRegistry } from "../utils/TimerRegistry.js";
import type { GatewaySender, VoiceServerData, VoiceStateData } from "./gatewayTypes.js";
import { parseVoiceRegion } from "./regions.js";

/**
 * What a voice bridge needs from its player.
 */
export interface VoiceBridgeHost {
  /** Guild id. */
  readonly guildId: string;
  /** Sends opcode 4 to Discord. */
  readonly send: GatewaySender;
  /** Owns the join timeout. */
  readonly timers: TimerRegistry;
  /** How long to wait for Discord's voice packets, in milliseconds. */
  readonly timeoutMs: number;
  /**
   * Hands voice credentials to the node.
   *
   * @param voice - Complete credentials.
   */
  pushVoice(voice: ApiVoiceState): Promise<void>;
  /**
   * Discord says the bot left voice: kicked, channel deleted, or left on purpose.
   */
  onDisconnected(): void;
  /**
   * The bot was moved to another channel.
   *
   * @param from - Old channel.
   * @param to - New channel.
   */
  onMoved(from: string, to: string): void;
  /**
   * Voice state flags changed (mute, deaf, suppress).
   *
   * @param state - The new state.
   */
  onStateFlags(state: VoiceStateData): void;
  /**
   * Pushing credentials to the node failed.
   *
   * @param error - What went wrong.
   */
  onPushError(error: unknown): void;
}

/**
 * Voice credentials, as saved for resume.
 */
export interface VoiceSnapshot {
  /** Voice channel. */
  channelId: string | null;
  /** Discord voice session id. */
  sessionId: string | null;
  /** Voice token. */
  token: string | null;
  /** Voice server. */
  endpoint: string | null;
}

/**
 * Self-deaf and self-mute flags.
 */
export interface VoiceFlags {
  /** Join deafened. */
  selfDeaf?: boolean;
  /** Join muted. */
  selfMute?: boolean;
}

interface Pending {
  resolve(): void;
  reject(error: Error): void;
  cancelTimeout(): void;
}

/**
 * Connects a player to Discord voice through the node.
 *
 * Discord sends two packets per join or move: `VOICE_STATE_UPDATE` (session id, channel) and
 * `VOICE_SERVER_UPDATE` (token, endpoint). They can arrive in any order, twice, or with a `null`
 * endpoint while Discord switches servers. Every packet bumps a revision number, only one update
 * is sent to the node at a time, and an update that finishes after a newer packet arrived is
 * sent again. That avoids the "joined but no sound" race.
 */
export class VoiceBridge {
  /** Voice channel the bot is in, or joining. */
  channelId: string | null = null;
  /** Discord voice session id. */
  sessionId: string | null = null;
  /** Voice token. */
  token: string | null = null;
  /** Voice server host. */
  endpoint: string | null = null;
  /** Region parsed from the endpoint. */
  region: string | null = null;
  /** Whether the bot joins deafened. */
  selfDeaf = true;
  /** Whether the bot joins muted. */
  selfMute = false;

  readonly #host: VoiceBridgeHost;
  #revision = 0;
  #applied = 0;
  #generation = 0;
  #inFlight: Promise<void> | null = null;
  #pending: Pending | null = null;
  #connected = false;

  /**
   * Creates a bridge.
   *
   * @param host - The owning player.
   */
  constructor(host: VoiceBridgeHost) {
    this.#host = host;
  }

  /**
   * Whether the node has received complete credentials.
   *
   * @returns `true` once connected.
   */
  get connected(): boolean {
    return this.#connected;
  }

  /**
   * Joins (or moves to) a voice channel and waits until the node has the credentials.
   *
   * @param channelId - Channel to join.
   * @returns Resolves when the node has the credentials.
   * @throws {LunalinkError} `VOICE_CONNECTION_TIMEOUT` when Discord's packets don't arrive.
   */
  async join(channelId: string): Promise<void> {
    this.#pending?.reject(new LunalinkError(ErrorCode.Aborted, "A newer join replaced this one."));
    const previous = this.channelId;
    this.channelId = channelId;
    if (previous !== channelId) {
      this.#connected = false;
      this.token = null;
      this.endpoint = null;
    }
    const waiting = this.#waitForConnection();
    await this.#sendOpcode();
    return waiting;
  }

  /**
   * Leaves voice and forgets the credentials.
   */
  async leave(): Promise<void> {
    this.#generation++;
    this.#pending?.reject(new LunalinkError(ErrorCode.Aborted, "Left the voice channel."));
    this.channelId = null;
    this.#clear();
    await this.#sendOpcode();
  }

  /**
   * Changes self-deaf and self-mute and tells Discord.
   *
   * @param flags - New flags. Missing ones stay as they are.
   */
  async setFlags(flags: VoiceFlags): Promise<void> {
    if (flags.selfDeaf !== undefined) this.selfDeaf = flags.selfDeaf;
    if (flags.selfMute !== undefined) this.selfMute = flags.selfMute;
    if (this.channelId !== null) await this.#sendOpcode();
  }

  /**
   * Applies a `VOICE_STATE_UPDATE` about the bot itself.
   *
   * @param data - The packet's `d`.
   */
  handleStateUpdate(data: VoiceStateData): void {
    if (data.channel_id === null) {
      const wasInVoice = this.channelId !== null;
      this.#generation++;
      this.channelId = null;
      this.#clear();
      this.#pending?.reject(
        new LunalinkError(ErrorCode.Aborted, "Discord removed the bot from voice."),
      );
      if (wasInVoice) this.#host.onDisconnected();
      return;
    }
    const previous = this.channelId;
    this.channelId = data.channel_id;
    this.sessionId = data.session_id;
    this.#host.onStateFlags(data);
    if (previous !== null && previous !== data.channel_id)
      this.#host.onMoved(previous, data.channel_id);
    void this.#schedulePush();
  }

  /**
   * Applies a `VOICE_SERVER_UPDATE`.
   *
   * @param data - The packet's `d`.
   */
  handleServerUpdate(data: VoiceServerData): void {
    if (data.endpoint === null) {
      this.#connected = false;
      return;
    }
    this.token = data.token;
    this.endpoint = data.endpoint;
    this.region = parseVoiceRegion(data.endpoint);
    void this.#schedulePush();
  }

  /**
   * Sends the current credentials again, for example to a new node.
   *
   * @returns Resolves when the node has them.
   */
  resend(): Promise<void> {
    return this.#schedulePush();
  }

  /**
   * Current credentials, or `null` when something is missing.
   *
   * @returns Credentials for the node.
   */
  credentials(): ApiVoiceState | null {
    if (!this.channelId || !this.sessionId || !this.token || !this.endpoint) return null;
    return {
      token: this.token,
      endpoint: this.endpoint,
      sessionId: this.sessionId,
      channelId: this.channelId,
    };
  }

  /**
   * Saves the credentials for persistence.
   *
   * @returns A snapshot.
   */
  snapshot(): VoiceSnapshot {
    return {
      channelId: this.channelId,
      sessionId: this.sessionId,
      token: this.token,
      endpoint: this.endpoint,
    };
  }

  /**
   * Loads saved credentials without sending anything.
   *
   * @param snapshot - Saved credentials.
   */
  load(snapshot: VoiceSnapshot): void {
    this.channelId = snapshot.channelId;
    this.sessionId = snapshot.sessionId;
    this.token = snapshot.token;
    this.endpoint = snapshot.endpoint;
    this.region = parseVoiceRegion(snapshot.endpoint);
  }

  /**
   * Cancels a pending join and stops pushing. Used on destroy.
   */
  dispose(): void {
    this.#generation++;
    this.#pending?.reject(
      new LunalinkError(ErrorCode.PlayerDestroyed, "The player was destroyed."),
    );
  }

  #clear(): void {
    this.#connected = false;
    this.sessionId = null;
    this.token = null;
    this.endpoint = null;
    this.region = null;
  }

  async #sendOpcode(): Promise<void> {
    await this.#host.send(this.#host.guildId, {
      op: 4,
      d: {
        guild_id: this.#host.guildId,
        channel_id: this.channelId,
        self_mute: this.selfMute,
        self_deaf: this.selfDeaf,
      },
    });
  }

  #schedulePush(): Promise<void> {
    this.#revision++;
    return this.#startDrain();
  }

  #startDrain(): Promise<void> {
    this.#inFlight ??= this.#drain().finally(() => {
      this.#inFlight = null;
      if (this.#applied !== this.#revision) void this.#startDrain();
    });
    return this.#inFlight;
  }

  async #drain(): Promise<void> {
    while (this.#applied !== this.#revision) {
      this.#applied = this.#revision;
      const generation = this.#generation;
      const voice = this.credentials();
      if (!voice) return;
      try {
        await this.#host.pushVoice(voice);
      } catch (error) {
        if (generation === this.#generation) this.#host.onPushError(error);
        return;
      }
      if (generation !== this.#generation) return;
      if (this.#applied === this.#revision) {
        this.#connected = true;
        this.#pending?.resolve();
      }
    }
  }

  #waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cancelTimeout = this.#host.timers.timeout(() => {
        this.#pending = null;
        reject(this.#timeoutError());
      }, this.#host.timeoutMs);
      this.#pending = {
        resolve: () => {
          cancelTimeout();
          this.#pending = null;
          resolve();
        },
        reject: (error) => {
          cancelTimeout();
          this.#pending = null;
          reject(error);
        },
        cancelTimeout,
      };
    });
  }

  #timeoutError(): LunalinkError {
    const missing: string[] = [];
    if (!this.sessionId) missing.push("VOICE_STATE_UPDATE");
    if (!this.token || !this.endpoint) missing.push("VOICE_SERVER_UPDATE");
    const hint =
      missing.length > 0
        ? ` Discord never sent ${missing.join(" and ")}. Check that the bot has the GuildVoiceStates intent and that raw packets reach Lunalink.`
        : " The node didn't accept the voice credentials in time.";
    return new LunalinkError(
      ErrorCode.VoiceConnectionTimeout,
      `Couldn't connect to voice within ${this.#host.timeoutMs} ms.${hint}`,
      { details: { guildId: this.#host.guildId, channelId: this.channelId, missing } },
    );
  }
}
