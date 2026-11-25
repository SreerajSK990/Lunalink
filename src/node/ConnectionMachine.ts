import type { SocketFactory, SocketHandle } from "../transport/ws/SocketFactory.js";
import { backoffDelay } from "../utils/backoff.js";
import type { TimerRegistry } from "../utils/TimerRegistry.js";

/**
 * What the machine asks its owner to do, and what it reports back.
 */
export interface ConnectionHooks {
  /**
   * Runs before each attempt. Throwing fails the attempt.
   *
   * @param signal - Aborted when the machine stops.
   */
  preflight(signal: AbortSignal): Promise<void>;
  /**
   * Builds the upgrade headers for an attempt.
   *
   * @returns Headers.
   */
  headers(): Record<string, string>;
  /** The socket opened. */
  onOpen(): void;
  /**
   * A message arrived.
   *
   * @param data - Text or bytes.
   */
  onMessage(data: string | Uint8Array): void;
  /**
   * An open socket closed.
   *
   * @param code - Close code.
   * @param reason - Close reason.
   */
  onClose(code: number, reason: string): void;
  /**
   * A retry is scheduled.
   *
   * @param attempt - Consecutive failures so far.
   * @param delayMs - Wait before the next attempt.
   * @param error - Why the last attempt failed.
   */
  onRetry(attempt: number, delayMs: number, error: unknown): void;
  /**
   * The machine stopped trying.
   *
   * @param error - The last failure.
   */
  onGiveUp(error: unknown): void;
  /**
   * Decides whether a failure is permanent, such as a wrong password.
   *
   * @param error - The failure.
   * @returns `true` to stop retrying.
   */
  isFatal(error: unknown): boolean;
}

/**
 * Settings for {@link ConnectionMachine}.
 */
export interface ConnectionMachineOptions {
  /** WebSocket address. */
  url: string;
  /** Opens sockets. */
  socketFactory: SocketFactory;
  /** Backoff settings. */
  reconnect: { baseDelayMs: number; maxDelayMs: number; maxAttempts: number };
  /** Reconnect when the socket is silent for this long. 0 turns it off. */
  silenceTimeoutMs: number;
  /** Owns the retry and silence timers. */
  timers: TimerRegistry;
}

/**
 * The machine's state.
 */
export type ConnectionState = "stopped" | "connecting" | "open" | "waiting";

/**
 * Keeps one WebSocket connection alive: preflight, connect, retry with backoff, and reconnect
 * when the socket goes quiet.
 *
 * Every attempt gets a number, and callbacks from older attempts are ignored. That's what stops
 * a late error from an earlier attempt from tearing down a connection that just succeeded.
 */
export class ConnectionMachine {
  readonly #options: ConnectionMachineOptions;
  readonly #hooks: ConnectionHooks;
  #state: ConnectionState = "stopped";
  #attemptId = 0;
  #failures = 0;
  #socket: SocketHandle | null = null;
  #abort: AbortController | null = null;
  #cancelRetry: (() => void) | null = null;
  #cancelSilence: (() => void) | null = null;

  /**
   * Creates a machine. Nothing happens until {@link ConnectionMachine.start}.
   *
   * @param options - Address, factory, backoff and timers.
   * @param hooks - Callbacks into the owner.
   */
  constructor(options: ConnectionMachineOptions, hooks: ConnectionHooks) {
    this.#options = options;
    this.#hooks = hooks;
  }

  /**
   * Current state.
   *
   * @returns The state.
   */
  get state(): ConnectionState {
    return this.#state;
  }

  /**
   * Starts connecting. Does nothing when already running.
   */
  start(): void {
    if (this.#state !== "stopped") return;
    this.#failures = 0;
    void this.#attempt();
  }

  /**
   * Resets the failure count. Call it once the server confirms the connection works.
   */
  markHealthy(): void {
    this.#failures = 0;
  }

  /**
   * Drops the current socket and reconnects right away.
   *
   * @param reason - Close reason sent to the server.
   */
  reconnectNow(reason = "Reconnecting"): void {
    if (this.#state === "stopped") return;
    this.#cancelRetry?.();
    if (this.#socket) {
      this.#socket.close(4000, reason);
      return;
    }
    void this.#attempt();
  }

  /**
   * Stops for good: cancels timers and closes the socket.
   *
   * @param code - Close code.
   * @param reason - Close reason.
   */
  stop(code = 1000, reason = "Client stopped"): void {
    this.#state = "stopped";
    this.#attemptId++;
    this.#abort?.abort();
    this.#abort = null;
    this.#cancelRetry?.();
    this.#cancelSilence?.();
    const socket = this.#socket;
    this.#socket = null;
    socket?.close(code, reason);
  }

  async #attempt(): Promise<void> {
    const id = ++this.#attemptId;
    this.#state = "connecting";
    this.#abort = new AbortController();
    try {
      await this.#hooks.preflight(this.#abort.signal);
    } catch (error) {
      if (id === this.#attemptId) this.#fail(error);
      return;
    }
    if (id !== this.#attemptId) return;
    let lastError: unknown = null;
    let opened = false;
    try {
      this.#socket = this.#options.socketFactory(this.#options.url, this.#hooks.headers(), {
        onOpen: () => {
          if (id !== this.#attemptId) return;
          opened = true;
          this.#state = "open";
          this.#armSilence(id);
          this.#hooks.onOpen();
        },
        onMessage: (data) => {
          if (id !== this.#attemptId) return;
          this.#armSilence(id);
          this.#hooks.onMessage(data);
        },
        onError: (error) => {
          if (id === this.#attemptId) lastError = error;
        },
        onClose: (code, reason) => {
          if (id !== this.#attemptId) return;
          this.#socket = null;
          this.#cancelSilence?.();
          if (opened) this.#hooks.onClose(code, reason);
          this.#fail(
            lastError ?? new Error(`WebSocket closed with ${code}${reason ? `: ${reason}` : ""}`),
          );
        },
      });
    } catch (error) {
      this.#giveUp(error);
    }
  }

  #fail(error: unknown): void {
    if (this.#state === "stopped") return;
    if (this.#hooks.isFatal(error)) {
      this.#giveUp(error);
      return;
    }
    this.#failures++;
    if (this.#failures > this.#options.reconnect.maxAttempts) {
      this.#giveUp(error);
      return;
    }
    const delayMs = backoffDelay(this.#failures - 1, {
      baseMs: this.#options.reconnect.baseDelayMs,
      maxMs: this.#options.reconnect.maxDelayMs,
    });
    this.#state = "waiting";
    this.#hooks.onRetry(this.#failures, delayMs, error);
    this.#cancelRetry = this.#options.timers.timeout(() => {
      this.#cancelRetry = null;
      void this.#attempt();
    }, delayMs);
  }

  #giveUp(error: unknown): void {
    this.stop(1000, "Gave up");
    this.#hooks.onGiveUp(error);
  }

  #armSilence(id: number): void {
    const timeoutMs = this.#options.silenceTimeoutMs;
    if (timeoutMs <= 0) return;
    this.#cancelSilence?.();
    this.#cancelSilence = this.#options.timers.timeout(() => {
      if (id === this.#attemptId) this.reconnectNow("No messages from the server");
    }, timeoutMs);
  }
}
