import { afterEach, describe, expect, it } from "vitest";
import type { GatewayAdapter, GatewayPacket } from "../../src/core/GatewayAdapter.js";
import { Lunalink } from "../../src/core/Lunalink.js";
import type { LunalinkOptions } from "../../src/core/LunalinkOptions.js";
import { definePlugin } from "../../src/plugins/Plugin.js";
import { UnresolvedTrack } from "../../src/track/UnresolvedTrack.js";
import type { VoiceStateUpdatePayload } from "../../src/voice/gatewayTypes.js";
import { MockServer } from "../mock/MockServer.js";
import { track } from "../mock/fixtures.js";

const BOT = "170939974227541168";
const GUILD = "81384788765712384";
const CHANNEL = "81384788862181376";
const USER = "80351110224678912";

const servers: MockServer[] = [];
const clients: Lunalink[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) await client.shutdown();
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

function fakeDiscord() {
  let handler: ((packet: GatewayPacket) => void) | null = null;
  const sent: VoiceStateUpdatePayload[] = [];
  const deliver = (packet: GatewayPacket): void => handler?.(packet);
  const adapter: GatewayAdapter = {
    clientId: () => BOT,
    send: (guildId, payload) => {
      sent.push(payload);
      if (payload.d.channel_id === null) return;
      queueMicrotask(() => {
        deliver({
          t: "VOICE_STATE_UPDATE",
          d: {
            guild_id: guildId,
            channel_id: payload.d.channel_id,
            user_id: BOT,
            session_id: "voice-session",
          },
        });
        deliver({
          t: "VOICE_SERVER_UPDATE",
          d: { guild_id: guildId, token: "voice-token", endpoint: "us-east1234.discord.media:443" },
        });
      });
    },
    listen: (next) => {
      handler = next;
      return () => {
        handler = null;
      };
    },
  };
  return { adapter, sent, deliver };
}

async function setup(extra: Partial<LunalinkOptions> = {}) {
  const server = await new MockServer({ kind: "lavalink" }).start();
  servers.push(server);
  server.loadTracks = (identifier) =>
    identifier.startsWith("ytsearch:")
      ? { loadType: "search", data: [track("a"), track("b")] }
      : { loadType: "empty", data: null };
  const discord = fakeDiscord();
  const lunalink = new Lunalink({
    adapter: discord.adapter,
    nodes: [{ id: "main", host: "127.0.0.1", port: server.port, password: "youshallnotpass" }],
    ...extra,
  });
  clients.push(lunalink);
  discord.deliver({
    t: "GUILD_CREATE",
    d: { id: GUILD, members: [], voice_states: [{ user_id: USER, channel_id: CHANNEL }] },
  });
  await lunalink.connect();
  return { server, lunalink, discord };
}

describe("Lunalink against a mock Lavalink", () => {
  it("searches, joins voice, plays and reports track events", async () => {
    const { server, lunalink } = await setup();
    const result = await lunalink.search("lofi", { requester: { id: USER } });
    expect(result.type).toBe("search");
    expect(server.requests.some((r) => r.query.get("identifier") === "ytsearch:lofi")).toBe(true);

    const player = lunalink.players.create({ guildId: GUILD, voiceChannelId: CHANNEL });
    await player.connect();
    expect(player.voice.credentials()).toMatchObject({ token: "voice-token" });

    const started = lunalink.waitFor("trackStart", { timeoutMs: 1_000 });
    const first = result.tracks[0];
    if (!first) throw new Error("no track");
    expect(await player.play(first)).toBe(true);
    server.sendTrackStart(GUILD, track("a"));
    const [, startedTrack] = await started;
    expect(startedTrack.title).toBe("Song a");
    expect(startedTrack.requester).toEqual({ id: USER });

    const ended = lunalink.waitFor("queueEnd", { timeoutMs: 1_000 });
    server.sendTrackEnd(GUILD, track("a"));
    await ended;
  });

  it("leaves when the queue stays empty", async () => {
    const { server, lunalink } = await setup({ autoLeave: { emptyQueueMs: 20 } });
    const player = lunalink.players.create({ guildId: GUILD, voiceChannelId: CHANNEL });
    await player.connect();
    const first = (await lunalink.search("lofi")).tracks[0];
    if (!first) throw new Error("no track");
    await player.play(first);
    server.sendTrackStart(GUILD, track("a"));
    const destroyed = lunalink.waitFor("playerDestroy", { timeoutMs: 1_000 });
    server.sendTrackEnd(GUILD, track("a"));
    const [, reason] = await destroyed;
    expect(reason).toBe("autoLeave");
  });

  it("asks plugin resolvers first and lets hooks and interceptors act", async () => {
    const plugin = definePlugin({
      name: "test",
      version: "1.0.0",
      apiVersion: 1,
      setup: (ctx) => {
        ctx.resolvers.register({
          name: "custom",
          match: (query) => query.startsWith("custom:"),
          resolve: () => ({
            type: "track",
            items: [UnresolvedTrack.create({ title: "Custom song" })],
          }),
        });
        ctx.events.intercept("playerCreate", (event) => {
          event.suppress("test");
        });
        return undefined;
      },
    });
    const { lunalink } = await setup({ plugins: [plugin] });
    const result = await lunalink.search("custom:1");
    expect(result.tracks[0]).toMatchObject({ kind: "unresolved", title: "Custom song" });
    let created = false;
    lunalink.on("playerCreate", () => {
      created = true;
    });
    lunalink.players.create({ guildId: GUILD, voiceChannelId: CHANNEL });
    expect(created).toBe(false);
    expect(lunalink.plugins.list()[0]?.status).toBe("active");
  });

  it("enables resuming and reports a seamless resume after a reconnect", async () => {
    const { server, lunalink } = await setup();
    const player = lunalink.players.create({ guildId: GUILD, voiceChannelId: CHANNEL });
    await player.connect();
    const first = (await lunalink.search("lofi")).tracks[0];
    if (!first) throw new Error("no track");
    await player.play(first);
    server.sendTrackStart(GUILD, track("a"));
    await lunalink.waitFor("trackStart", { timeoutMs: 1_000 });
    expect(server.resumable).toBe(true);
    const stored = server.players.get(GUILD);
    if (stored) stored.state.connected = true;
    const resumed = lunalink.waitFor("playerResumed", { timeoutMs: 3_000 });
    server.dropConnections();
    const [, info] = await resumed;
    expect(info.mode).toBe("seamless");
  });
});
