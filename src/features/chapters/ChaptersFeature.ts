import { normalizeChapters } from "../../drivers/index.js";
import type { Chapter } from "../../drivers/types.js";
import { UnsupportedFeatureError } from "../../errors/UnsupportedFeatureError.js";
import { Routes } from "../../transport/http/routes.js";
import type { Track } from "../../track/Track.js";
import type { FeatureHost } from "../FeatureHost.js";

/**
 * Chapters of the playing video, available as `player.chapters`.
 *
 * NodeLink loads them on request. The Lavalink SponsorBlock plugin pushes them in a
 * `ChaptersLoaded` event instead, so on Lavalink this returns what that event last delivered.
 */
export class ChaptersFeature {
  readonly #host: FeatureHost;
  #fromEvent: { encoded: string; chapters: Chapter[] } | null = null;

  /**
   * Creates the feature.
   *
   * @param host - The owning player.
   */
  constructor(host: FeatureHost) {
    this.#host = host;
  }

  /**
   * Chapters of a track, or of the playing track.
   *
   * @param track - Track to look up. Defaults to the playing one.
   * @returns The chapters. Empty when the video has none.
   * @throws {UnsupportedFeatureError} When the node has no chapter support.
   */
  async get(track: Track | null = this.#host.currentTrack()): Promise<Chapter[]> {
    if (!track) return [];
    const node = this.#host.node();
    if (node.kind === "nodelink") {
      const body = await node.rest.request<unknown>("GET", Routes.nodeLinkChapters(), {
        query: { encodedTrack: track.encoded },
      });
      return Array.isArray(body) ? normalizeChapters(body) : [];
    }
    if (!node.supports("chapters")) {
      throw new UnsupportedFeatureError(
        "chapters",
        node.id,
        "Install the SponsorBlock plugin on Lavalink, or use NodeLink.",
      );
    }
    return this.#fromEvent?.encoded === track.encoded ? [...this.#fromEvent.chapters] : [];
  }

  /**
   * Remembers chapters from a `ChaptersLoaded` event. Called by the player.
   *
   * @param chapters - The chapters.
   */
  remember(chapters: Chapter[]): void {
    const track = this.#host.currentTrack();
    this.#fromEvent = track ? { encoded: track.encoded, chapters } : null;
  }
}
