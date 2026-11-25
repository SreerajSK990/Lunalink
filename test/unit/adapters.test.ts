import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { discordjs } from "../../src/adapters/discordjs.js";
import { eris } from "../../src/adapters/eris.js";
import { oceanic } from "../../src/adapters/oceanic.js";
import { raw } from "../../src/adapters/raw.js";
import { seyfert, seyfertRawEvent } from "../../src/adapters/seyfert.js";
import { shardIdFor } from "../../src/adapters/shared.js";
import type { GatewayPacket, VoiceStateUpdatePayload } from "../../src/index.js";

const GUILD = "81384788765712384";
const payload: VoiceStateUpdatePayload = {
  op: 4,
  d: { guild_id: GUILD, channel_id: "1", self_mute: false, self_deaf: true },
};
const packet = { op: 0, s: 1, t: "VOICE_STATE_UPDATE", d: { user_id: "1" } };

describe("shardIdFor", () => {
  it("uses Discord's formula", () => {
    expect(shardIdFor(GUILD, 1)).toBe(0);
    expect(shardIdFor(GUILD, 5)).toBe(Number((BigInt(GUILD) >> 22n) % 5n));
  });
});

describe("discord.js adapter", () => {
  it("uses the raw event and guild.shard on v14", () => {
    const shardSend = vi.fn();
    const client = Object.assign(new EventEmitter(), {
      user: { id: "9" },
      ws: { shards: new Map() },
      guilds: { cache: { get: () => ({ shardId: 0, shard: { send: shardSend } }) } },
    });
    const adapter = discordjs(client);
    const seen: GatewayPacket[] = [];
    const off = adapter.listen((p) => seen.push(p));
    client.emit("raw", packet, 0);
    client.emit("raw", { op: 11, d: null }, 0);
    off();
    client.emit("raw", packet, 0);
    expect(seen).toEqual([{ t: "VOICE_STATE_UPDATE", d: { user_id: "1" } }]);
    void adapter.send(GUILD, payload);
    expect(shardSend).toHaveBeenCalledWith(payload);
    expect(adapter.clientId()).toBe("9");
  });

  it("uses ws dispatch and ws.send on the next major", () => {
    const ws = Object.assign(new EventEmitter(), { send: vi.fn() });
    const client = Object.assign(new EventEmitter(), {
      user: null,
      ws,
      options: { shardCount: 2 },
      guilds: { cache: { get: () => undefined } },
    });
    const adapter = discordjs(client);
    const seen: GatewayPacket[] = [];
    adapter.listen((p) => seen.push(p));
    ws.emit("dispatch", packet, 0);
    expect(seen).toHaveLength(1);
    void adapter.send(GUILD, payload);
    expect(ws.send).toHaveBeenCalledWith(shardIdFor(GUILD, 2), payload);
  });
});

describe("eris and oceanic adapters", () => {
  it("eris sends op and data through sendWS", () => {
    const sendWS = vi.fn();
    const client = Object.assign(new EventEmitter(), {
      guilds: { get: () => ({ shard: { sendWS } }) },
    });
    const adapter = eris(client);
    const seen: GatewayPacket[] = [];
    adapter.listen((p) => seen.push(p));
    client.emit("rawWS", packet, 0);
    void adapter.send(GUILD, payload);
    expect(seen).toHaveLength(1);
    expect(sendWS).toHaveBeenCalledWith(4, payload.d);
  });

  it("oceanic reads the bot id from READY", () => {
    const send = vi.fn();
    const client = Object.assign(new EventEmitter(), {
      guilds: { get: () => ({ shard: { send } }) },
    });
    const adapter = oceanic(client);
    adapter.listen(() => undefined);
    expect(adapter.clientId()).toBeUndefined();
    client.emit("packet", { op: 0, t: "READY", d: { user: { id: "42" } } }, 0);
    expect(adapter.clientId()).toBe("42");
    void adapter.send(GUILD, payload);
    expect(send).toHaveBeenCalledWith(4, payload.d);
  });
});

describe("seyfert and raw adapters", () => {
  it("seyfert routes the raw event and sends through the gateway", async () => {
    const send = vi.fn();
    const adapter = seyfert({ botId: "", gateway: { calculateShardId: () => 3, send } });
    const seen: GatewayPacket[] = [];
    adapter.listen((p) => seen.push(p));
    seyfertRawEvent(adapter).run(packet);
    await adapter.send(GUILD, payload);
    expect(seen).toHaveLength(1);
    expect(send).toHaveBeenCalledWith(3, payload);
    expect(adapter.clientId()).toBeUndefined();
  });

  it("seyfert workers send through their shard", async () => {
    const shardSend = vi.fn();
    const adapter = seyfert({
      botId: "7",
      calculateShardId: () => 1,
      shards: { get: () => ({ send: shardSend }) },
    });
    await adapter.send(GUILD, payload);
    expect(shardSend).toHaveBeenCalledWith(true, payload);
  });

  it("raw hands packets to every listener", () => {
    const adapter = raw({ clientId: () => "1", send: () => undefined });
    const seen: GatewayPacket[] = [];
    adapter.listen((p) => seen.push(p));
    adapter.handle(packet);
    adapter.handle("nope");
    expect(seen).toHaveLength(1);
  });
});
