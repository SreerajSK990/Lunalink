import type {
  ApiNodeLinkCrossfade,
  ApiNodeLinkFading,
  ApiNodeLinkMeaning,
  ApiNodeLinkMeaningResult,
} from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { Track } from "../../track/Track.js";
import type { FeatureHost } from "../FeatureHost.js";
import { MixerFeature } from "./MixerFeature.js";
import { VoiceReceiver } from "./VoiceReceiver.js";

/**
 * NodeLink-only player features, available as `player.nodelink`. Every method throws
 * `UnsupportedFeatureError` when the player is on a Lavalink node.
 *
 * @example
 * ```ts
 * if (player.node.kind === "nodelink") {
 *   await player.nodelink.setCrossfade({ enabled: true, duration: 4000 });
 * }
 * ```
 */
export class NodeLinkPlayerFeatures {
  /** Mix layers on top of the main track. */
  readonly mixer: MixerFeature;
  readonly #host: FeatureHost;

  /**
   * Creates the features.
   *
   * @param host - The owning player.
   */
  constructor(host: FeatureHost) {
    this.#host = host;
    this.mixer = new MixerFeature(host);
  }

  /**
   * Queues a track to start the moment the current one ends, with no gap. Lunalink's queue
   * handles this for you when `gapless` is on; use it directly only for custom flows.
   *
   * @param track - Track to start next, or `null` to clear.
   */
  async setNextTrack(track: Track | null): Promise<void> {
    this.#require("nodelink:gapless");
    await this.#host.update({
      nextTrack: track ? { encoded: track.encoded, userData: { ...track.userData } } : null,
    });
  }

  /**
   * Sets crossfading between tracks.
   *
   * @param crossfade - Crossfade settings.
   */
  async setCrossfade(crossfade: ApiNodeLinkCrossfade): Promise<void> {
    this.#require("nodelink:crossfade");
    await this.#host.update({ crossfade });
  }

  /**
   * Sets fades for track start, end, stop, seek, pause and resume, and the ducking curve.
   *
   * @param fading - Fade settings. `enabled` must be `true` for fades to happen.
   */
  async setFading(fading: ApiNodeLinkFading): Promise<void> {
    this.#require("nodelink:fading");
    await this.#host.update({ fading });
  }

  /**
   * Turns ducking (lowering the music under mix layers) on or off.
   *
   * @param enabled - On or off.
   */
  async setDucking(enabled: boolean): Promise<void> {
    this.#require("nodelink:fading");
    await this.#host.update({ ducking: enabled });
  }

  /**
   * Turns loudness normalization on or off.
   *
   * @param enabled - On or off.
   */
  async setLoudnessNormalizer(enabled: boolean): Promise<void> {
    this.#require("nodelink:loudness");
    await this.#host.update({ loudnessNormalizer: enabled });
  }

  /**
   * Looks up what a song is about.
   *
   * @param track - Track to look up. Defaults to the playing one.
   * @param language - Language for a translation, for example `en`.
   * @returns The meaning, or `null` when none was found.
   */
  async meaning(
    track: Track | null = this.#host.currentTrack(),
    language?: string,
  ): Promise<ApiNodeLinkMeaning | null> {
    if (!track) return null;
    const node = this.#require("nodelink:meaning");
    const result = await node.rest.request<ApiNodeLinkMeaningResult>(
      "GET",
      Routes.nodeLinkMeaning(),
      {
        query: { encodedTrack: track.encoded, lang: language },
      },
    );
    return result.loadType === "meaning" ? result.data : null;
  }

  /**
   * Starts receiving what people say in this player's voice channel.
   *
   * @returns The receiver. Close it when you're done.
   */
  receiveVoice(): VoiceReceiver {
    return new VoiceReceiver(this.#host.node(), this.#host.guildId);
  }

  #require(capability: string) {
    const node = this.#host.node();
    node.capabilities.require(capability, "This is a NodeLink feature.");
    return node;
  }
}
