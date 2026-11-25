import {
  Lunalink,
  type GatewayAdapter,
  type GatewayPacket,
  type LunalinkOptions,
  type VoiceStateUpdatePayload,
} from "../index.js";
import { MockNode, type MockNodeOptions } from "./MockNode.js";

/**
 * A fake Discord gateway. It answers every op 4 join with the two voice packets Discord sends,
 * so players connect without a real bot.
 */
export interface TestDiscord {
  /** The adapter to pass to Lunalink. */
  adapter: GatewayAdapter;
  /** Every op 4 payload Lunalink sent. */
  sent: VoiceStateUpdatePayload[];
  /**
   * Delivers a gateway packet to Lunalink.
   *
   * @param packet - The packet.
   */
  deliver(packet: GatewayPacket): void;
  /**
   * Makes a user join (or, with `null`, leave) a voice channel.
   *
   * @param guildId - Guild id.
   * @param channelId - Channel id, or `null` to leave.
   * @param userId - User id.
   */
  moveUser(guildId: string, channelId: string | null, userId: string): void;
}

/**
 * Fake Discord settings.
 */
export interface TestDiscordOptions {
  /** The bot's user id. Defaults to `170939974227541168`. */
  botId?: string;
  /** Voice endpoint in `VOICE_SERVER_UPDATE`. Defaults to `us-east1234.discord.media:443`. */
  endpoint?: string;
}

/**
 * Creates a fake Discord gateway.
 *
 * @param options - Bot id and voice endpoint.
 * @returns The fake gateway.
 */
export function createTestDiscord(options: TestDiscordOptions = {}): TestDiscord {
  const botId = options.botId ?? "170939974227541168";
  const endpoint = options.endpoint ?? "us-east1234.discord.media:443";
  const handlers = new Set<(packet: GatewayPacket) => void>();
  const sent: VoiceStateUpdatePayload[] = [];
  const deliver = (packet: GatewayPacket): void => {
    for (const handler of handlers) handler(packet);
  };
  const voiceState = (
    guildId: string,
    channelId: string | null,
    userId: string,
  ): GatewayPacket => ({
    t: "VOICE_STATE_UPDATE",
    d: { guild_id: guildId, channel_id: channelId, user_id: userId, session_id: `voice-${userId}` },
  });
  return {
    sent,
    deliver,
    moveUser: (guildId, channelId, userId) => {
      deliver(voiceState(guildId, channelId, userId));
    },
    adapter: {
      clientId: () => botId,
      send: (guildId, payload) => {
        sent.push(payload);
        queueMicrotask(() => {
          deliver(voiceState(guildId, payload.d.channel_id, botId));
          if (payload.d.channel_id !== null) {
            deliver({
              t: "VOICE_SERVER_UPDATE",
              d: { guild_id: guildId, token: "voice-token", endpoint },
            });
          }
        });
      },
      listen: (handler) => {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
    },
  };
}

/**
 * A connected Lunalink with a mock node and a fake Discord.
 */
export interface Harness {
  /** The mock node. */
  node: MockNode;
  /** The client, already connected. */
  lunalink: Lunalink;
  /** The fake Discord. */
  discord: TestDiscord;
  /** Shuts the client down and stops the mock node. */
  stop(): Promise<void>;
}

/**
 * Harness settings.
 */
export interface HarnessOptions {
  /** Mock node settings. */
  node?: MockNodeOptions;
  /** Fake Discord settings. */
  discord?: TestDiscordOptions;
  /** Extra Lunalink options, for example `plugins` or `autoLeave`. */
  lunalink?: Partial<Omit<LunalinkOptions, "adapter" | "nodes">>;
}

/**
 * Starts a mock node and connects a Lunalink to it through a fake Discord. Use it to test
 * plugins and bot code without a real server.
 *
 * @example
 * ```ts
 * const { lunalink, node, stop } = await createHarness({ lunalink: { plugins: [myPlugin()] } });
 * node.loadTracks = () => ({ loadType: "search", data: [track("a")] });
 * const result = await lunalink.search("anything");
 * await stop();
 * ```
 * @param options - Node, Discord and client settings.
 * @returns The harness.
 */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const node = await new MockNode(options.node).start();
  const discord = createTestDiscord(options.discord);
  const lunalink = new Lunalink({
    ...options.lunalink,
    adapter: discord.adapter,
    nodes: [{ id: "mock", host: "127.0.0.1", port: node.port, password: node.password }],
  });
  await lunalink.connect();
  return {
    node,
    lunalink,
    discord,
    stop: async () => {
      await lunalink.shutdown();
      await node.stop();
    },
  };
}
