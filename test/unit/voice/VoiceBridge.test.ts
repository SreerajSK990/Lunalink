import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../src/errors/ErrorCode.js";
import type { ApiVoiceState } from "../../../src/protocol/index.js";
import { TimerRegistry } from "../../../src/utils/TimerRegistry.js";
import type { VoiceStateUpdatePayload } from "../../../src/voice/gatewayTypes.js";
import { parseVoiceRegion } from "../../../src/voice/regions.js";
import { VoiceBridge, type VoiceBridgeHost } from "../../../src/voice/VoiceBridge.js";

const timers = new TimerRegistry();
afterEach(() => {
  timers.clearAll();
});

function setup(push: (voice: ApiVoiceState) => Promise<void> = () => Promise.resolve()) {
  const sent: VoiceStateUpdatePayload[] = [];
  const pushes: ApiVoiceState[] = [];
  const host: VoiceBridgeHost = {
    guildId: "100000000000000001",
    send: (_guild, payload) => {
      sent.push(payload);
    },
    timers,
    timeoutMs: 200,
    pushVoice: async (voice) => {
      pushes.push(voice);
      await push(voice);
    },
    onDisconnected: vi.fn(),
    onMoved: vi.fn(),
    onStateFlags: vi.fn(),
    onPushError: vi.fn(),
  };
  return { bridge: new VoiceBridge(host), sent, pushes, host };
}

const state = (channel: string | null, session = "s1") => ({
  guild_id: "100000000000000001",
  channel_id: channel,
  user_id: "200000000000000002",
  session_id: session,
});
const server = (token: string, endpoint: string | null = "c-bom06-1a2b.discord.media:443") => ({
  guild_id: "100000000000000001",
  token,
  endpoint,
});

describe("VoiceBridge", () => {
  it("sends opcode 4 and resolves once both packets reached the node", async () => {
    const { bridge, sent, pushes } = setup();
    const joining = bridge.join("300000000000000003");
    expect(sent[0]).toEqual({
      op: 4,
      d: {
        guild_id: "100000000000000001",
        channel_id: "300000000000000003",
        self_mute: false,
        self_deaf: true,
      },
    });
    bridge.handleServerUpdate(server("t1"));
    bridge.handleStateUpdate(state("300000000000000003"));
    await joining;
    expect(bridge.connected).toBe(true);
    expect(pushes.at(-1)).toEqual({
      token: "t1",
      endpoint: "c-bom06-1a2b.discord.media:443",
      sessionId: "s1",
      channelId: "300000000000000003",
    });
    expect(bridge.region).toBe("bom");
  });

  it("waits out a null endpoint", async () => {
    const { bridge, pushes } = setup();
    const joining = bridge.join("300000000000000003");
    bridge.handleStateUpdate(state("300000000000000003"));
    bridge.handleServerUpdate(server("t1", null));
    expect(pushes).toHaveLength(0);
    bridge.handleServerUpdate(server("t2"));
    await joining;
    expect(pushes.at(-1)?.token).toBe("t2");
  });

  it("re-sends when a newer packet arrives while a push is in flight", async () => {
    let release: () => void = () => undefined;
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const { bridge, pushes } = setup(() => (++calls === 1 ? first : Promise.resolve()));
    const joining = bridge.join("300000000000000003");
    bridge.handleStateUpdate(state("300000000000000003"));
    bridge.handleServerUpdate(server("t1"));
    bridge.handleServerUpdate(server("t2"));
    release();
    await joining;
    expect(pushes.map((voice) => voice.token)).toEqual(["t1", "t2"]);
  });

  it("times out and names the missing packet", async () => {
    const { bridge } = setup();
    const joining = bridge.join("300000000000000003");
    bridge.handleStateUpdate(state("300000000000000003"));
    await expect(joining).rejects.toMatchObject({
      code: ErrorCode.VoiceConnectionTimeout,
      message: expect.stringContaining("VOICE_SERVER_UPDATE") as unknown,
    });
  });

  it("reports a kick and a move", async () => {
    const { bridge, host } = setup();
    const joining = bridge.join("300000000000000003");
    bridge.handleStateUpdate(state("300000000000000003"));
    bridge.handleServerUpdate(server("t1"));
    await joining;
    bridge.handleStateUpdate(state("300000000000000004"));
    expect(host.onMoved).toHaveBeenCalledWith("300000000000000003", "300000000000000004");
    bridge.handleStateUpdate(state(null));
    expect(host.onDisconnected).toHaveBeenCalledOnce();
    expect(bridge.channelId).toBeNull();
  });
});

describe("parseVoiceRegion", () => {
  it.each([
    ["c-bom06-1a2b.discord.media:443", "bom"],
    ["us-east1234.discord.gg", "us-east"],
    ["rotterdam5678.discord.gg:443", "rotterdam"],
    [null, null],
    ["weird", null],
  ])("%s gives %s", (endpoint, region) => {
    expect(parseVoiceRegion(endpoint)).toBe(region);
  });
});
