import type { DebugEvent } from "../events/DebugEvent.js";
import type { EventInterceptor, InterceptedEvent } from "./events.js";
import { isolate, type PluginErrorHandler } from "./isolate.js";
import { OrderedRegistry } from "./OrderedRegistry.js";

/**
 * What the event bus needs.
 */
export interface EventBusHost {
  /** Reports a failing interceptor. */
  onError: PluginErrorHandler;
  /**
   * Logs a debug message.
   *
   * @param event - The message.
   */
  debug(event: DebugEvent): void;
  /** How long an async interceptor may hold an event, in milliseconds. */
  timeoutMs: number;
}

/**
 * Runs interceptors before events reach listeners. Interceptors run in priority order; any of
 * them can suppress the event, and an async one holds it until it settles.
 */
export class EventBus {
  readonly #host: EventBusHost;
  readonly #interceptors = new Map<string, OrderedRegistry<EventInterceptor>>();

  /**
   * Creates the bus.
   *
   * @param host - Error handler, debug output and timeout.
   */
  constructor(host: EventBusHost) {
    this.#host = host;
  }

  /**
   * Adds an interceptor.
   *
   * @param owner - Plugin name.
   * @param name - Event name.
   * @param interceptor - The interceptor.
   * @param priority - Higher runs first.
   * @returns A function that removes it.
   */
  intercept(owner: string, name: string, interceptor: EventInterceptor, priority = 0): () => void {
    let registry = this.#interceptors.get(name);
    if (!registry) {
      registry = new OrderedRegistry();
      this.#interceptors.set(name, registry);
    }
    return registry.add(owner, interceptor, priority);
  }

  /**
   * Removes every interceptor a plugin added.
   *
   * @param owner - Plugin name.
   */
  removeOwner(owner: string): void {
    for (const registry of this.#interceptors.values()) registry.removeOwner(owner);
  }

  /**
   * Sends an event through the interceptors, then delivers it unless one suppressed it.
   * Without async interceptors, delivery happens synchronously.
   *
   * @param name - Event name.
   * @param args - Event arguments.
   * @param deliver - Hands the event to listeners.
   */
  dispatch(name: string, args: readonly unknown[], deliver: () => void): void {
    const entries = this.#interceptors.get(name)?.entries() ?? [];
    if (entries.length === 0) {
      deliver();
      return;
    }
    let suppressedBy: string | null = null;
    let reason: string | undefined;
    const view = (owner: string): InterceptedEvent => ({
      name,
      args,
      get suppressed() {
        return suppressedBy !== null;
      },
      suppress: (why?: string) => {
        suppressedBy ??= owner;
        reason ??= why;
      },
    });
    const finish = (): void => {
      if (suppressedBy === null) {
        deliver();
        return;
      }
      this.#host.debug({
        scope: "plugins",
        level: "info",
        message: `Plugin "${suppressedBy}" suppressed the ${name} event`,
        ...(reason ? { data: { reason } } : {}),
      });
    };
    const pending: Promise<unknown>[] = [];
    for (const entry of entries) {
      try {
        const result = entry.item(view(entry.owner));
        if (result instanceof Promise) {
          const owner = entry.owner;
          pending.push(
            isolate(owner, `intercept ${name}`, () => result, {
              timeoutMs: this.#host.timeoutMs,
              fallback: undefined,
              onError: this.#host.onError,
            }),
          );
        }
      } catch (error) {
        this.#host.onError(entry.owner, `intercept ${name}`, error);
      }
    }
    if (pending.length === 0) finish();
    else void Promise.all(pending).then(finish);
  }
}
