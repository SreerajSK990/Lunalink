import { describe, expect, it, vi } from "vitest";
import { ConnectionMachine, type ConnectionHooks } from "../../../src/node/ConnectionMachine.js";
import type { SocketFactory, SocketHandlers } from "../../../src/transport/ws/SocketFactory.js";
import { TimerRegistry } from "../../../src/utils/TimerRegistry.js";

function setup(overrides: Partial<ConnectionHooks> = {}) {
  const sockets: { handlers: SocketHandlers; closed: boolean }[] = [];
  const factory: SocketFactory = (_url, _headers, handlers) => {
    const entry = { handlers, closed: false };
    sockets.push(entry);
    return {
      close(code = 1000, reason = "") {
        entry.closed = true;
        handlers.onClose(code, reason);
      },
    };
  };
  const hooks: ConnectionHooks = {
    preflight: vi.fn(() => Promise.resolve()),
    headers: () => ({}),
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onRetry: vi.fn(),
    onGiveUp: vi.fn(),
    isFatal: () => false,
    ...overrides,
  };
  const timers = new TimerRegistry();
  const machine = new ConnectionMachine(
    {
      url: "ws://x",
      socketFactory: factory,
      reconnect: { baseDelayMs: 10, maxDelayMs: 20, maxAttempts: 3 },
      silenceTimeoutMs: 0,
      timers,
    },
    hooks,
  );
  return { machine, sockets, hooks, timers };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ConnectionMachine", () => {
  it("opens a socket after a successful preflight", async () => {
    const { machine, sockets, hooks } = setup();
    machine.start();
    await tick();
    sockets[0]!.handlers.onOpen();
    expect(hooks.onOpen).toHaveBeenCalledOnce();
    expect(machine.state).toBe("open");
  });

  it("retries a failed preflight with backoff, then gives up", async () => {
    const { machine, hooks } = setup({ preflight: vi.fn(() => Promise.reject(new Error("down"))) });
    machine.start();
    await vi.waitFor(() => {
      expect(hooks.onGiveUp).toHaveBeenCalledOnce();
    });
    expect(hooks.onRetry).toHaveBeenCalledTimes(3);
    expect(machine.state).toBe("stopped");
  });

  it("stops immediately on a fatal error", async () => {
    const { machine, hooks } = setup({
      preflight: vi.fn(() => Promise.reject(new Error("bad password"))),
      isFatal: () => true,
    });
    machine.start();
    await vi.waitFor(() => {
      expect(hooks.onGiveUp).toHaveBeenCalledOnce();
    });
    expect(hooks.onRetry).not.toHaveBeenCalled();
  });

  it("ignores a late error from an earlier attempt once a newer one succeeded", async () => {
    const { machine, sockets, hooks } = setup();
    machine.start();
    await tick();
    const first = sockets[0]!;
    first.handlers.onClose(1006, "");
    await vi.waitFor(() => {
      expect(sockets).toHaveLength(2);
    });
    const second = sockets[1]!;
    second.handlers.onOpen();
    first.handlers.onError(new Error("stale"));
    first.handlers.onClose(1006, "stale close");
    expect(machine.state).toBe("open");
    expect(hooks.onRetry).toHaveBeenCalledTimes(1);
  });

  it("resets the failure count once marked healthy", async () => {
    const { machine, sockets, hooks } = setup();
    machine.start();
    await tick();
    for (let round = 0; round < 5; round++) {
      const socket = sockets.at(-1)!;
      socket.handlers.onOpen();
      machine.markHealthy();
      socket.handlers.onClose(1006, "");
      await vi.waitFor(() => {
        expect(sockets).toHaveLength(round + 2);
      });
    }
    expect(hooks.onGiveUp).not.toHaveBeenCalled();
  });

  it("stop clears timers and ignores later callbacks", async () => {
    const { machine, sockets, timers, hooks } = setup();
    machine.start();
    await tick();
    sockets[0]!.handlers.onOpen();
    machine.stop();
    expect(sockets[0]!.closed).toBe(true);
    expect(timers.size).toBe(0);
    expect(hooks.onRetry).not.toHaveBeenCalled();
  });
});
