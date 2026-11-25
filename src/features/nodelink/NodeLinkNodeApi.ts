import type { Node } from "../../node/Node.js";
import type { ApiNodeLinkConnection, ApiNodeLinkEncodeInput } from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import { LiveChat } from "./LiveChat.js";
import { VoiceReceiver } from "./VoiceReceiver.js";

/**
 * NodeLink endpoints that aren't tied to a player. Every method throws
 * `UnsupportedFeatureError` on a Lavalink node.
 *
 * Endpoints whose response shape changes between NodeLink versions (`/v4/workers`,
 * `/v4/youtube/config`, `/v4/youtube/oauth`, `/v4/sources/health`, the profiler, HLS and raw
 * streams) aren't wrapped. Call them through `node.rest.request()`.
 */
export class NodeLinkNodeApi {
  readonly #node: Node;

  /**
   * Creates the API.
   *
   * @param node - The node.
   */
  constructor(node: Node) {
    this.#node = node;
  }

  /**
   * Builds an encoded track from track info, without loading anything.
   *
   * @param info - Track info.
   * @returns The encoded track.
   */
  async encodeTrack(info: ApiNodeLinkEncodeInput): Promise<string> {
    this.#node.capabilities.require("nodelink:encode", "Encoding tracks is a NodeLink feature.");
    return this.#node.rest.request("GET", Routes.nodeLinkEncodeTrack(), {
      query: { track: JSON.stringify(info) },
    });
  }

  /**
   * Builds several encoded tracks in one request.
   *
   * @param infos - Track infos.
   * @returns Encoded tracks, in the same order.
   */
  async encodeTracks(infos: readonly ApiNodeLinkEncodeInput[]): Promise<string[]> {
    this.#node.capabilities.require("nodelink:encode", "Encoding tracks is a NodeLink feature.");
    return this.#node.rest.request("POST", Routes.nodeLinkEncodeTracks(), { body: infos });
  }

  /**
   * Network quality as NodeLink measured it.
   *
   * @returns Status and the last measurement.
   */
  async connection(): Promise<ApiNodeLinkConnection> {
    this.#node.capabilities.require(
      "nodelink:connection",
      "Connection metrics are a NodeLink feature.",
    );
    return this.#node.rest.request("GET", Routes.nodeLinkConnection());
  }

  /**
   * Starts receiving voice for a guild.
   *
   * @param guildId - Guild to listen to.
   * @returns The receiver. Close it when you're done.
   */
  receiveVoice(guildId: string): VoiceReceiver {
    return new VoiceReceiver(this.#node, guildId);
  }

  /**
   * Starts reading a YouTube live stream's chat.
   *
   * @param videoId - Video id or link.
   * @returns The chat reader. Close it when you're done.
   */
  liveChat(videoId: string): LiveChat {
    return new LiveChat(this.#node, videoId);
  }
}
