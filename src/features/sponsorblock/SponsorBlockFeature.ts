import { UnsupportedFeatureError } from "../../errors/UnsupportedFeatureError.js";
import type {
  ApiNodeLinkSponsorBlockSegment,
  ApiNodeLinkSponsorBlockState,
  ApiNodeLinkSponsorBlockUpdate,
  ApiSponsorBlockCategory,
} from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { FeatureHost } from "../FeatureHost.js";

const HINT = "Install the SponsorBlock plugin on Lavalink, or use NodeLink.";

/**
 * SponsorBlock for one player, available as `player.sponsorBlock`. The Lavalink plugin and
 * NodeLink use different endpoints and bodies; this class hides that.
 *
 * - Lavalink plugin: `PUT/GET/DELETE …/sponsorblock/categories` with a plain array.
 * - NodeLink: `PATCH/GET/DELETE …/sponsorblock` with `{ enabled, categories, … }`.
 *
 * @example
 * ```ts
 * await player.sponsorBlock.setCategories(["sponsor", "selfpromo"]);
 * lunalink.on("segmentSkipped", (player, segment) => console.log("Skipped", segment.category));
 * ```
 */
export class SponsorBlockFeature {
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
   * Whether the player's node supports SponsorBlock.
   *
   * @returns `true` with the plugin or NodeLink.
   */
  get available(): boolean {
    return this.#host.node().supports("sponsorblock");
  }

  /**
   * Turns skipping on for these categories.
   *
   * @param categories - Categories to skip, for example `["sponsor", "intro"]`.
   * @throws {UnsupportedFeatureError} When the node has no SponsorBlock support.
   */
  async setCategories(
    categories: readonly (ApiSponsorBlockCategory | (string & Record<never, never>))[],
  ): Promise<void> {
    const { node, sessionId, guildId } = this.#target();
    if (node.supports("sponsorblock:nodelink")) {
      const body: ApiNodeLinkSponsorBlockUpdate = { enabled: true, categories: [...categories] };
      await node.rest.request("PATCH", Routes.nodeLinkSponsorBlock(sessionId, guildId), { body });
      return;
    }
    await node.rest.request("PUT", Routes.sponsorBlockCategories(sessionId, guildId), {
      body: [...categories],
    });
  }

  /**
   * Reads the categories being skipped.
   *
   * @returns The categories.
   */
  async getCategories(): Promise<string[]> {
    const { node, sessionId, guildId } = this.#target();
    if (node.supports("sponsorblock:nodelink")) return (await this.state()).categories;
    return node.rest.request("GET", Routes.sponsorBlockCategories(sessionId, guildId));
  }

  /**
   * Turns SponsorBlock off for this player.
   */
  async clear(): Promise<void> {
    const { node, sessionId, guildId } = this.#target();
    const path = node.supports("sponsorblock:nodelink")
      ? Routes.nodeLinkSponsorBlock(sessionId, guildId)
      : Routes.sponsorBlockCategories(sessionId, guildId);
    await node.rest.request("DELETE", path);
  }

  /**
   * NodeLink's full SponsorBlock state, including loaded segments.
   *
   * @returns The state.
   * @throws {UnsupportedFeatureError} On Lavalink.
   */
  async state(): Promise<ApiNodeLinkSponsorBlockState> {
    const { node, sessionId, guildId } = this.#target();
    node.capabilities.require(
      "sponsorblock:nodelink",
      "Only NodeLink exposes the full SponsorBlock state.",
    );
    return node.rest.request("GET", Routes.nodeLinkSponsorBlock(sessionId, guildId));
  }

  /**
   * Changes NodeLink's SponsorBlock settings, such as action types or the skip margin.
   *
   * @param update - Settings to change.
   * @returns The new state.
   * @throws {UnsupportedFeatureError} On Lavalink.
   */
  async configure(update: ApiNodeLinkSponsorBlockUpdate): Promise<ApiNodeLinkSponsorBlockState> {
    const { node, sessionId, guildId } = this.#target();
    node.capabilities.require("sponsorblock:nodelink", "Only NodeLink has these settings.");
    return node.rest.request("PATCH", Routes.nodeLinkSponsorBlock(sessionId, guildId), {
      body: update,
    });
  }

  /**
   * Gives NodeLink your own segments for the current track.
   *
   * @param segments - Segments to use.
   * @throws {UnsupportedFeatureError} On Lavalink.
   */
  async setSegments(segments: readonly ApiNodeLinkSponsorBlockSegment[]): Promise<void> {
    const { node, sessionId, guildId } = this.#target();
    node.capabilities.require("sponsorblock:nodelink", "Only NodeLink accepts custom segments.");
    await node.rest.request("POST", Routes.nodeLinkSponsorBlock(sessionId, guildId), {
      body: { segments },
    });
  }

  #target() {
    const node = this.#host.node();
    if (!node.supports("sponsorblock"))
      throw new UnsupportedFeatureError("sponsorblock", node.id, HINT);
    return { node, sessionId: node.requireSessionId(), guildId: this.#host.guildId };
  }
}
