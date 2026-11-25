import type { ApiTrack, ApiTrackInfo, JsonObject } from "../protocol/index.js";
import type { Requester } from "./Register.js";
import type { UnresolvedTrack } from "./UnresolvedTrack.js";

/**
 * A playable track: something the node already loaded and can play right away.
 *
 * Tracks are immutable. Methods like {@link Track.withRequester} return a copy.
 *
 * @example
 * ```ts
 * const result = await lunalink.search("lofi hip hop", { requester: interaction.user });
 * const track = result.tracks[0];
 * console.log(track?.title, track?.duration);
 * ```
 */
export class Track {
  /** Tells tracks and unresolved tracks apart. */
  readonly kind = "track" as const;
  /** Encoded blob the node plays. */
  readonly encoded: string;
  /** Metadata from the node. */
  readonly info: Readonly<ApiTrackInfo>;
  /** Extra data from server plugins, for example LavaSrc's album name. */
  readonly pluginInfo: Readonly<JsonObject>;
  /** Your own data, sent to the node and echoed back in events. */
  readonly userData: Readonly<JsonObject>;
  /** Who asked for this track. Type it through `Register`. */
  readonly requester: Requester | undefined;
  /** The track it was resolved from, for example the Spotify track behind a YouTube mirror. */
  readonly origin: UnresolvedTrack | undefined;

  /**
   * Creates a track. Most code gets tracks from `search()` instead.
   *
   * @param api - Track as the node sent it.
   * @param requester - Who asked for it.
   * @param origin - The unresolved track it came from, if any.
   */
  constructor(api: ApiTrack, requester?: Requester, origin?: UnresolvedTrack) {
    this.encoded = api.encoded;
    this.info = Object.freeze({ ...api.info });
    this.pluginInfo = Object.freeze({ ...api.pluginInfo });
    this.userData = Object.freeze({ ...api.userData });
    this.requester = requester;
    this.origin = origin;
  }

  /**
   * Title. When the track was mirrored, this is the original title (for example from Spotify).
   *
   * @returns The title.
   */
  get title(): string {
    return this.origin?.title ?? this.info.title;
  }

  /**
   * Artist or uploader, preferring the original's when mirrored.
   *
   * @returns The author.
   */
  get author(): string {
    return this.origin?.author ?? this.info.author;
  }

  /**
   * Length in milliseconds.
   *
   * @returns The length.
   */
  get duration(): number {
    return this.info.length;
  }

  /**
   * Link to the track, preferring the original's when mirrored.
   *
   * @returns The link, or `null`.
   */
  get uri(): string | null {
    return this.origin?.uri ?? this.info.uri;
  }

  /**
   * Artwork link, preferring the original's when mirrored.
   *
   * @returns The link, or `null`.
   */
  get artworkUrl(): string | null {
    return this.origin?.artworkUrl ?? this.info.artworkUrl;
  }

  /**
   * ISRC, when known.
   *
   * @returns The ISRC, or `null`.
   */
  get isrc(): string | null {
    return this.info.isrc ?? this.origin?.isrc ?? null;
  }

  /**
   * Source manager that loaded it, for example `youtube`.
   *
   * @returns The source name.
   */
  get sourceName(): string {
    return this.info.sourceName;
  }

  /**
   * Source-specific id.
   *
   * @returns The identifier.
   */
  get identifier(): string {
    return this.info.identifier;
  }

  /**
   * Whether it's a live stream.
   *
   * @returns `true` for streams.
   */
  get isStream(): boolean {
    return this.info.isStream;
  }

  /**
   * Whether seeking works.
   *
   * @returns `true` when seekable.
   */
  get isSeekable(): boolean {
    return this.info.isSeekable;
  }

  /**
   * Returns a copy with a different requester.
   *
   * @param requester - New requester.
   * @returns A new track.
   */
  withRequester(requester: Requester | undefined): Track {
    return new Track(this.toApi(), requester, this.origin);
  }

  /**
   * Returns a copy with different user data.
   *
   * @param userData - New user data.
   * @returns A new track.
   */
  withUserData(userData: JsonObject): Track {
    return new Track({ ...this.toApi(), userData }, this.requester, this.origin);
  }

  /**
   * Converts back to the node's track format.
   *
   * @returns The track as the node expects it.
   */
  toApi(): ApiTrack {
    return {
      encoded: this.encoded,
      info: { ...this.info },
      pluginInfo: { ...this.pluginInfo },
      userData: { ...this.userData },
    };
  }
}
