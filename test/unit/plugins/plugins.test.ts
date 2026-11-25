import { describe, expect, it, vi } from "vitest";
import { TypedEmitter } from "../../../src/events/TypedEmitter.js";
import { EventBus } from "../../../src/plugins/EventBus.js";
import type { LunalinkEvents } from "../../../src/plugins/events.js";
import { definePlugin, type LunalinkPlugin } from "../../../src/plugins/Plugin.js";
import type { PluginServices } from "../../../src/plugins/PluginContext.js";
import { PluginHost } from "../../../src/plugins/PluginHost.js";
import { MemoryStore } from "../../../src/stores-builtin/MemoryStore.js";
import { Track } from "../../../src/track/Track.js";
import { UnresolvedTrack } from "../../../src/track/UnresolvedTrack.js";
import { track } from "../../mock/fixtures.js";

function setup() {
  const emitter = new TypedEmitter<LunalinkEvents>();
  const store = new MemoryStore();
  const errors: [string, string][] = [];
  const services: PluginServices = {
    search: () =>
      Promise.resolve({ type: "empty", tracks: [], playlist: null, error: null, nodeId: null }),
    getPlayer: () => undefined,
    listPlayers: () => [],
    listNodes: () => [],
    on: (name, listener) => emitter.on(name, listener),
    emitCustom: (name, args) => {
      emitter.emit(name, ...args);
    },
    addAutoplayStrategy: () => () => undefined,
    store: () => store,
    debug: () => undefined,
  };
  const host = new PluginHost(services, (plugin, label) => errors.push([plugin, label]), {
    callTimeoutMs: 50,
    setupTimeoutMs: 50,
  });
  return { host, emitter, store, errors };
}

const plugin = (name: string, extra: Partial<LunalinkPlugin> = {}): LunalinkPlugin =>
  definePlugin({ name, version: "1.0.0", apiVersion: 1, setup: () => undefined, ...extra });

describe("PluginHost", () => {
  it("sets plugins up dependencies first", async () => {
    const { host } = setup();
    const order: string[] = [];
    await host.add(plugin("b", { dependsOn: ["a"], setup: () => void order.push("b") }));
    await host.add(plugin("a", { setup: () => void order.push("a") }));
    await host.start();
    expect(order).toEqual(["a", "b"]);
    expect(host.list().map((info) => info.status)).toEqual(["active", "active"]);
  });

  it("rejects another plugin API version", async () => {
    const { host } = setup();
    await expect(host.add(plugin("old", { apiVersion: 0 }))).rejects.toThrow(/plugin API/);
  });

  it("marks a throwing plugin failed and fails its dependents", async () => {
    const { host, errors } = setup();
    await host.add(
      plugin("bad", {
        setup: () => {
          throw new Error("boom");
        },
      }),
    );
    await host.add(plugin("child", { dependsOn: ["bad"] }));
    await host.add(plugin("fine"));
    await host.start();
    const status = Object.fromEntries(host.list().map((info) => [info.name, info.status]));
    expect(status).toEqual({ bad: "failed", child: "failed", fine: "active" });
    expect(errors).toContainEqual(["bad", "setup"]);
  });

  it("times out a slow setup", async () => {
    const { host } = setup();
    await host.add(plugin("slow", { setup: () => new Promise<undefined>(() => undefined) }));
    await host.start();
    expect(host.list()[0]?.status).toBe("failed");
  });

  it("removes everything a plugin registered on teardown", async () => {
    const { host, emitter } = setup();
    const listener = vi.fn();
    const teardown = vi.fn();
    await host.add(
      plugin("p", {
        setup: (ctx) => {
          ctx.resolvers.register({
            name: "r",
            match: () => true,
            resolve: () => ({ type: "empty", items: [] }),
          });
          ctx.events.on("debug", listener);
          return teardown;
        },
      }),
    );
    await host.start();
    expect(host.resolvers.size).toBe(1);
    await host.remove("p");
    emitter.emit("debug", { scope: "x", level: "info", message: "m" });
    expect(host.resolvers.size).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(teardown).toHaveBeenCalled();
  });

  it("refuses two owners for one slot", async () => {
    const { host } = setup();
    await host.add(plugin("q1", { slots: ["queue"] }));
    await expect(host.add(plugin("q2", { slots: ["queue"] }))).rejects.toThrow(/both replace/);
    await host.add(plugin("q3", { slots: ["queue"], overrides: ["q1"] }));
  });

  it("namespaces storage and track data", async () => {
    const { host, store } = setup();
    let tagged: Track | undefined;
    await host.add(
      plugin("stats", {
        setup: async (ctx) => {
          await ctx.storage.set("plays", 3);
          tagged = ctx.trackData.with(new Track(track("a")), { liked: true });
          expect(ctx.trackData.get(tagged)).toEqual({ liked: true });
          return undefined;
        },
      }),
    );
    await host.start();
    expect(store.get("plugin:stats:plays")).toBe(3);
    expect(tagged?.userData["plugin:stats"]).toEqual({ liked: true });
  });
});

describe("resolvers", () => {
  it("runs matching resolvers by priority and falls through on empty results", async () => {
    const { host, errors } = setup();
    await host.add(
      plugin("p", {
        setup: (ctx) => {
          ctx.resolvers.register({
            name: "empty",
            priority: 10,
            match: () => true,
            resolve: () => ({ type: "empty", items: [] }),
          });
          ctx.resolvers.register({
            name: "broken",
            priority: 5,
            match: () => true,
            resolve: () => {
              throw new Error("x");
            },
          });
          ctx.resolvers.register({
            name: "spotify",
            match: (query) => query.includes("spotify.com"),
            resolve: () => ({ type: "track", items: [UnresolvedTrack.create({ title: "Song" })] }),
          });
          return undefined;
        },
      }),
    );
    await host.start();
    const hit = await host.resolve({ query: "https://open.spotify.com/track/1" });
    expect(hit?.resolver).toBe("spotify");
    expect(errors).toContainEqual(["p", "broken.resolve"]);
    expect(host.explain("https://open.spotify.com/track/1").handledBy?.resolver).toBe("empty");
  });

  it("reports a malformed result with the plugin and field", async () => {
    const { host, errors } = setup();
    await host.add(
      plugin("bad", {
        setup: (ctx) => {
          ctx.resolvers.register({
            name: "r",
            match: () => true,
            resolve: () => ({ type: "track", items: [{ nope: 1 } as never] }),
          });
          return undefined;
        },
      }),
    );
    await host.start();
    expect(await host.resolve({ query: "x" })).toBeNull();
    expect(errors).toContainEqual(["bad", "r.resolve"]);
  });
});

describe("hooks and interception", () => {
  it("lets beforePlay replace or skip a track", async () => {
    const { host } = setup();
    const a = new Track(track("a"));
    const b = new Track(track("b"));
    host.hooks.add("p", "beforePlay", (_player, current) => (current === a ? b : null));
    expect(await host.hooks.beforePlay({} as never, a)).toBe(b);
    expect(await host.hooks.beforePlay({} as never, b)).toBeNull();
  });

  it("suppresses events and holds them for async interceptors", async () => {
    const debug = vi.fn();
    const bus = new EventBus({ onError: () => undefined, debug, timeoutMs: 50 });
    const deliver = vi.fn();
    const off = bus.intercept("p", "trackStart", (event) => {
      event.suppress("intro");
    });
    bus.dispatch("trackStart", [], deliver);
    expect(deliver).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalled();
    off();
    bus.intercept("p", "trackStart", () => Promise.resolve());
    bus.dispatch("trackStart", [], deliver);
    expect(deliver).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});
