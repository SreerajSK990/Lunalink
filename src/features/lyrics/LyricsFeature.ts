import {
  normalizeLavaLyrics,
  normalizeLyricsKt,
  normalizeNodeLinkLyrics,
} from "../../drivers/index.js";
import type { Lyrics } from "../../drivers/types.js";
import { ErrorCode } from "../../errors/ErrorCode.js";
import { RestError } from "../../errors/RestError.js";
import { UnsupportedFeatureError } from "../../errors/UnsupportedFeatureError.js";
import { ValidationError } from "../../errors/ValidationError.js";
import type { ApiLyricsKtSearchTrack, ApiNodeLinkLyricsResult } from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { Track } from "../../track/Track.js";
import type { FeatureHost } from "../FeatureHost.js";

/**
 * Options for fetching lyrics.
 */
export interface LyricsOptions {
  /** Don't ask the track's own source (for example YouTube captions). LavaLyrics and NodeLink. */
  skipTrackSource?: boolean;
  /** Language to translate or pick, for example `en`. NodeLink only. */
  language?: string;
}

const HINT = "Install LavaLyrics or lyrics.kt on Lavalink, or use NodeLink.";

/**
 * Lyrics for one player, available as `player.lyrics`. It picks the backend the node has:
 * NodeLink's built-in lyrics, LavaLyrics, or lyrics.kt, in that order, and always returns the
 * same {@link Lyrics} shape.
 *
 * @example
 * ```ts
 * const lyrics = await player.lyrics.current();
 * if (lyrics) await channel.send(lyrics.text.slice(0, 1900));
 * await player.lyrics.subscribe();
 * lunalink.on("lyricsLine", (player, line) => console.log(line.text));
 * ```
 */
export class LyricsFeature {
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
   * Whether the player's node can fetch lyrics.
   *
   * @returns `true` when a lyrics backend is available.
   */
  get available(): boolean {
    return this.#host.node().supports("lyrics");
  }

  /**
   * Whether the node can stream lyrics line by line.
   *
   * @returns `true` with LavaLyrics or NodeLink.
   */
  get liveAvailable(): boolean {
    return this.#host.node().supports("lyrics:live");
  }

  /**
   * Lyrics for the track that's playing.
   *
   * @param options - Source options.
   * @returns The lyrics, or `null` when none were found.
   * @throws {UnsupportedFeatureError} When the node has no lyrics backend.
   * @throws {ValidationError} When nothing is playing.
   */
  async current(options: LyricsOptions = {}): Promise<Lyrics | null> {
    const track = this.#host.currentTrack();
    if (!track) throw new ValidationError("track", "nothing is playing");
    const node = this.#host.node();
    const onlyLyricsKt =
      node.supports("lyrics:lyricskt") &&
      !node.supports("lyrics:lavalyrics") &&
      !node.supports("lyrics:nodelink");
    if (!onlyLyricsKt) return this.get(track, options);
    const sessionId = node.requireSessionId();
    return orNull(async () =>
      normalizeLyricsKt(
        await node.rest.request("GET", Routes.lyricsKtCurrent(sessionId, this.#host.guildId)),
      ),
    );
  }

  /**
   * Lyrics for any track.
   *
   * @param track - The track.
   * @param options - Source options.
   * @returns The lyrics, or `null` when none were found.
   * @throws {UnsupportedFeatureError} When the node has no backend that can look up this track.
   */
  async get(track: Track, options: LyricsOptions = {}): Promise<Lyrics | null> {
    const node = this.#host.node();
    if (node.supports("lyrics:nodelink")) {
      const result = await node.rest.request<ApiNodeLinkLyricsResult>(
        "GET",
        Routes.nodeLinkLyrics(),
        {
          query: { encodedTrack: track.encoded, lang: options.language },
        },
      );
      return result.loadType === "lyrics" ? normalizeNodeLinkLyrics(result.data) : null;
    }
    if (node.supports("lyrics:lavalyrics")) {
      return orNull(async () => {
        const body = await node.rest.request<unknown>("GET", Routes.lavaLyrics(), {
          query: { track: track.encoded, skipTrackSource: options.skipTrackSource ?? false },
        });
        return body === undefined ? null : normalizeLavaLyrics(body, "lavalyrics");
      });
    }
    if (node.supports("lyrics:lyricskt") && track.sourceName === "youtube") {
      return orNull(async () =>
        normalizeLyricsKt(await node.rest.request("GET", Routes.lyricsKtByVideo(track.identifier))),
      );
    }
    throw new UnsupportedFeatureError("lyrics", node.id, HINT);
  }

  /**
   * Searches lyrics by text. lyrics.kt only.
   *
   * @param query - Text to search for.
   * @returns Matches. Pass a match's `videoId` to lyrics.kt to load its lyrics.
   * @throws {UnsupportedFeatureError} Without lyrics.kt.
   */
  async search(query: string): Promise<ApiLyricsKtSearchTrack[]> {
    const node = this.#host.node();
    node.capabilities.require("lyrics:lyricskt", "Searching lyrics by text needs lyrics.kt.");
    return node.rest.request("GET", Routes.lyricsKtSearch(query));
  }

  /**
   * Starts live lyrics. The node then sends `lyricsFound` or `lyricsNotFound` for each track,
   * and `lyricsLine` as each line is reached.
   *
   * @param options - Source options.
   * @throws {UnsupportedFeatureError} Without LavaLyrics or NodeLink.
   */
  async subscribe(options: LyricsOptions = {}): Promise<void> {
    const node = this.#host.node();
    node.capabilities.require(
      "lyrics:live",
      "Live lyrics need LavaLyrics on Lavalink, or NodeLink.",
    );
    await node.rest.request(
      "POST",
      Routes.lyricsSubscribe(node.requireSessionId(), this.#host.guildId),
      {
        query: { skipTrackSource: options.skipTrackSource ?? false },
      },
    );
  }

  /**
   * Stops live lyrics.
   */
  async unsubscribe(): Promise<void> {
    const node = this.#host.node();
    if (!node.supports("lyrics:live")) return;
    await node.rest.request(
      "DELETE",
      Routes.lyricsSubscribe(node.requireSessionId(), this.#host.guildId),
    );
  }
}

async function orNull(load: () => Promise<Lyrics | null>): Promise<Lyrics | null> {
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof RestError &&
      error.code === ErrorCode.RestRequestFailed &&
      error.status === 404
    ) {
      return null;
    }
    throw error;
  }
}
