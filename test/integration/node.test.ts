import { afterEach, describe, expect, it } from "vitest";
import { ErrorCode } from "../../src/errors/ErrorCode.js";
import type { DebugEvent } from "../../src/events/DebugEvent.js";
import { NodeManager } from "../../src/node/NodeManager.js";
import type { NodeRuntime } from "../../src/node/Node.js";
import { builtInSocketFactory } from "../../src/transport/ws/SocketFactory.js";
import { MockServer } from "../mock/MockServer.js";

const servers: MockServer[] = [];
const managers: NodeManager[] = [];

afterEach(async () => {
  for (const manager of managers.splice(0)) manager.destroyAll();
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

function runtime(logs: DebugEvent[] = []): NodeRuntime {
  return {
    userId: () => "170939974227541168",
    clientName: "lunalink/0.1.0",
    socketFactory: builtInSocketFactory,
    fetch: undefined,
    capabilityRules: () => [],
    debug: (event) => logs.push(event),
  };
}

async function setup(kind: "lavalink" | "nodelink" = "lavalink", password = "youshallnotpass") {
  const server = await new MockServer({ kind }).start();
  servers.push(server);
  const manager = new NodeManager(runtime());
  managers.push(manager);
  const node = manager.add({
    id: kind,
    host: "127.0.0.1",
    port: server.port,
    password,
    reconnect: { baseDelayMs: 10, maxDelayMs: 20 },
  });
  return { server, manager, node };
}

describe("Node against a mock server", () => {
  it("connects to Lavalink, reads info and gets a session", async () => {
    const { server, node } = await setup("lavalink");
    await node.connect();
    expect(node.state).toBe("ready");
    expect(node.kind).toBe("lavalink");
    expect(node.sessionId).toBe(server.sessionId);
    expect(node.capabilities.has("filter:timescale")).toBe(true);
    expect(server.upgrades[0]?.["user-id"]).toBe("170939974227541168");
    expect(server.upgrades[0]?.["client-name"]).toBe("lunalink/0.1.0");
    await node.events.waitFor("stats", { timeoutMs: 1_000 }).catch(() => undefined);
    expect(node.stats?.cpu.serverLoad).toBe(0.05);
  });

  it("detects NodeLink without being told", async () => {
    const { node } = await setup("nodelink");
    await node.connect();
    expect(node.kind).toBe("nodelink");
    expect(node.capabilities.has("nodelink:mixer")).toBe(true);
  });

  it("gives up on a wrong password with UNAUTHORIZED", async () => {
    const { node } = await setup("lavalink", "wrong");
    await expect(node.connect()).rejects.toMatchObject({ code: ErrorCode.Unauthorized });
    expect(node.state).toBe("disconnected");
  });

  it("reconnects after a drop and resumes the session when the server keeps it", async () => {
    const { server, node } = await setup("lavalink");
    await node.connect();
    await node.rest.updateSession({ resuming: true, timeout: 60 });
    const firstSession = node.sessionId;
    const resumed = node.events.waitFor("ready", { timeoutMs: 2_000 });
    server.dropConnections();
    const [wasResumed, sessionId] = await resumed;
    expect(wasResumed).toBe(true);
    expect(sessionId).toBe(firstSession);
    expect(server.upgrades.at(-1)?.["session-id"]).toBe(firstSession);
  });

  it("starts a new session when the server forgot the old one", async () => {
    const { server, node } = await setup("lavalink");
    await node.connect();
    const firstSession = node.sessionId;
    const ready = node.events.waitFor("ready", { timeoutMs: 2_000 });
    server.dropConnections();
    const [wasResumed, sessionId] = await ready;
    expect(wasResumed).toBe(false);
    expect(sessionId).not.toBe(firstSession);
  });

  it("selects the least loaded ready node", async () => {
    const { manager, node } = await setup("lavalink");
    await node.connect();
    expect(manager.select({ guildId: "1", region: null, exclude: new Set() })).toBe(node);
    expect(() =>
      manager.select({ guildId: "1", region: null, exclude: new Set([node.id]) }),
    ).toThrow(expect.objectContaining({ code: ErrorCode.NoNodesAvailable }) as Error);
  });
});
