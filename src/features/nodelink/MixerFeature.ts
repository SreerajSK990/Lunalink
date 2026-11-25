import type { ApiNodeLinkMixLayer } from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { Track } from "../../track/Track.js";
import type { FeatureHost } from "../FeatureHost.js";

/**
 * NodeLink mix layers: extra tracks played on top of the main one, such as a sound effect or a
 * voice-over. Available as `player.nodelink.mixer`.
 *
 * Source: `src/api/sessions.id.players.id.mix.ts` and `mix.id.ts` in NodeLink.
 */
export class MixerFeature {
  readonly #host: FeatureHost;

  /**
   * Creates the feature.
   *
   * @param host - The owning player.
   */
  constructor(host: FeatureHost) {
    this.#host = host;
  }

  /**
   * Starts playing a track on top of the main one.
   *
   * @param track - Track to mix in.
   * @param volume - Layer volume, 0 to 1. NodeLink's configured default applies when left out.
   * @returns The new layer.
   */
  async add(track: Track, volume?: number): Promise<ApiNodeLinkMixLayer> {
    const { node, path } = this.#target();
    return node.rest.request("POST", path, {
      body: { track: { encoded: track.encoded }, ...(volume === undefined ? {} : { volume }) },
    });
  }

  /**
   * Lists the active layers.
   *
   * @returns The layers.
   */
  async list(): Promise<ApiNodeLinkMixLayer[]> {
    const { node, path } = this.#target();
    const body = await node.rest.request<{ mixes?: ApiNodeLinkMixLayer[] }>("GET", path);
    return body.mixes ?? [];
  }

  /**
   * Changes a layer's volume.
   *
   * @param mixId - Layer id.
   * @param volume - New volume, 0 to 1.
   */
  async setVolume(mixId: string, volume: number): Promise<void> {
    const { node, sessionId } = this.#target();
    await node.rest.request(
      "PATCH",
      Routes.nodeLinkMixLayer(sessionId, this.#host.guildId, mixId),
      {
        body: { volume },
      },
    );
  }

  /**
   * Stops a layer.
   *
   * @param mixId - Layer id.
   */
  async remove(mixId: string): Promise<void> {
    const { node, sessionId } = this.#target();
    await node.rest.request(
      "DELETE",
      Routes.nodeLinkMixLayer(sessionId, this.#host.guildId, mixId),
    );
  }

  #target() {
    const node = this.#host.node();
    node.capabilities.require("nodelink:mixer", "Mix layers are a NodeLink feature.");
    const sessionId = node.requireSessionId();
    return { node, sessionId, path: Routes.nodeLinkMix(sessionId, this.#host.guildId) };
  }
}
