/**
 * Maps event names to the arguments their listeners receive.
 */
export type EventMap<Events> = { [Name in keyof Events]: unknown[] };

/**
 * A listener for one event. It may be async; a rejected promise is caught and reported.
 */
export type Listener<Args extends unknown[]> = (...args: Args) => void | Promise<void>;

/**
 * Called when a listener throws or its promise rejects.
 *
 * @param error - What the listener threw.
 * @param eventName - The event that was being handled.
 */
export type ListenerErrorHandler = (error: unknown, eventName: string) => void;

/**
 * Options for {@link TypedEmitter.waitFor}.
 */
export interface WaitForOptions<Args extends unknown[]> {
  /** Only resolve for events that pass this check. */
  filter?: (...args: Args) => boolean;
  /** Reject after this many milliseconds. */
  timeoutMs?: number;
  /** Reject when this signal aborts. */
  signal?: AbortSignal;
}

/**
 * A small event emitter with typed event names and arguments.
 *
 * It differs from Node's `EventEmitter` in two ways that matter for bots: a listener that throws
 * or rejects never breaks the emitter or the other listeners (the error goes to
 * `onListenerError`), and it has no special `error` event that crashes the process when nobody
 * listens.
 *
 * @example
 * ```ts
 * const emitter = new TypedEmitter<{ ready: [sessionId: string] }>();
 * emitter.on("ready", (sessionId) => console.log(sessionId));
 * emitter.emit("ready", "abc");
 * ```
 */
export class TypedEmitter<Events extends EventMap<Events>> {
  readonly #listeners = new Map<keyof Events, Set<Listener<never>>>();
  #onListenerError: ListenerErrorHandler;

  /**
   * Creates an emitter.
   *
   * @param onListenerError - Receives errors thrown by listeners. Defaults to ignoring them.
   */
  constructor(onListenerError: ListenerErrorHandler = () => undefined) {
    this.#onListenerError = onListenerError;
  }

  /**
   * Replaces the listener error handler.
   *
   * @param handler - New handler.
   */
  setListenerErrorHandler(handler: ListenerErrorHandler): void {
    this.#onListenerError = handler;
  }

  /**
   * Adds a listener.
   *
   * @param name - Event name.
   * @param listener - Callback.
   * @returns A function that removes the listener.
   */
  on<Name extends keyof Events>(name: Name, listener: Listener<Events[Name]>): () => void {
    let set = this.#listeners.get(name);
    if (!set) {
      set = new Set();
      this.#listeners.set(name, set);
    }
    set.add(listener);
    return () => {
      this.off(name, listener);
    };
  }

  /**
   * Adds a listener that runs once and then removes itself.
   *
   * @param name - Event name.
   * @param listener - Callback.
   * @returns A function that removes the listener before it runs.
   */
  once<Name extends keyof Events>(name: Name, listener: Listener<Events[Name]>): () => void {
    const wrapper: Listener<Events[Name]> = (...args) => {
      this.off(name, wrapper);
      return listener(...args);
    };
    return this.on(name, wrapper);
  }

  /**
   * Removes a listener.
   *
   * @param name - Event name.
   * @param listener - The callback that was added.
   */
  off<Name extends keyof Events>(name: Name, listener: Listener<Events[Name]>): void {
    const set = this.#listeners.get(name);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.#listeners.delete(name);
  }

  /**
   * Waits for the next time an event fires.
   *
   * @param name - Event name.
   * @param options - Optional filter, timeout in milliseconds, and abort signal.
   * @returns The event's arguments.
   * @throws {Error} When the timeout passes or the signal aborts first.
   */
  waitFor<Name extends keyof Events>(
    name: Name,
    options: WaitForOptions<Events[Name]> = {},
  ): Promise<Events[Name]> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = (): void => {
        remove();
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = (): void => {
        cleanup();
        reject(new Error(`Stopped waiting for "${String(name)}"`));
      };
      const remove = this.on(name, (...args) => {
        if (options.filter && !options.filter(...args)) return;
        cleanup();
        resolve(args);
      });
      if (options.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          cleanup();
          reject(
            new Error(`Timed out after ${options.timeoutMs} ms waiting for "${String(name)}"`),
          );
        }, options.timeoutMs);
      }
      if (options.signal?.aborted) onAbort();
      else options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Calls every listener of an event, in the order they were added.
   *
   * @param name - Event name.
   * @param args - Arguments for the listeners.
   * @returns `true` when at least one listener ran.
   */
  emit<Name extends keyof Events>(name: Name, ...args: Events[Name]): boolean {
    const set = this.#listeners.get(name);
    if (!set || set.size === 0) return false;
    for (const listener of [...set]) {
      try {
        const result = (listener as Listener<Events[Name]>)(...args);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.#reportListenerError(error, name);
          });
        }
      } catch (error) {
        this.#reportListenerError(error, name);
      }
    }
    return true;
  }

  /**
   * Counts the listeners of an event.
   *
   * @param name - Event name.
   * @returns Number of listeners.
   */
  listenerCount(name: keyof Events): number {
    return this.#listeners.get(name)?.size ?? 0;
  }

  /**
   * Removes every listener of one event, or of all events.
   *
   * @param name - Event name. Leave it out to clear everything.
   */
  removeAllListeners(name?: keyof Events): void {
    if (name === undefined) this.#listeners.clear();
    else this.#listeners.delete(name);
  }

  #reportListenerError(error: unknown, name: keyof Events): void {
    try {
      this.#onListenerError(error, String(name));
    } catch {
      return;
    }
  }
}
