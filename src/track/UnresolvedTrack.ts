import { ValidationError } from "../errors/ValidationError.js";
import type { JsonObject } from "../protocol/index.js";
import { isNonEmptyString } from "../utils/guards.js";
import type { Requester } from "./Register.js";

/**
 * What you need to describe a song that isn't playable yet.
 */
export interface UnresolvedTrackInput {
  /** Song title. Required. */
  title: string;
  /** Artist. */
  author?: string;
  /** Length in milliseconds. Helps pick the right match. */
  durationMs?: number;
  /** ISRC. The most reliable way to find the exact recording. */
  isrc?: string;
  /** Link to the original, for example a Spotify track link. */
  uri?: string;
  /** Artwork link. */
  artworkUrl?: string;
  /** Where the metadata came from, for example `spotify`. */
  source?: string;
  /** Who asked for it. */
  requester?: Requester;
  /** Data for plugins, kept through the queue and resume. */
  extra?: JsonObject;
}

/**
 * A song Lunalink knows about but hasn't loaded yet, for example a Spotify track from a
 * client-side resolver. It sits in the queue with its own title and artwork, and is turned into
 * a playable track just before it plays.
 *
 * @example
 * ```ts
 * const song = UnresolvedTrack.create({ title: "Blinding Lights", author: "The Weeknd", isrc: "USUG11904206" });
 * await player.queue.add(song);
 * ```
 */
export class UnresolvedTrack {
  /** Tells unresolved tracks and tracks apart. */
  readonly kind = "unresolved" as const;
  /** Song title. */
  readonly title: string;
  /** Artist, or `null`. */
  readonly author: string | null;
  /** Length in milliseconds, or `null`. */
  readonly durationMs: number | null;
  /** ISRC, or `null`. */
  readonly isrc: string | null;
  /** Link to the original, or `null`. */
  readonly uri: string | null;
  /** Artwork link, or `null`. */
  readonly artworkUrl: string | null;
  /** Where the metadata came from, or `null`. */
  readonly source: string | null;
  /** Who asked for it. */
  readonly requester: Requester | undefined;
  /** Plugin data. */
  readonly extra: Readonly<JsonObject>;

  private constructor(input: UnresolvedTrackInput) {
    this.title = input.title;
    this.author = input.author ?? null;
    this.durationMs = input.durationMs ?? null;
    this.isrc = input.isrc ?? null;
    this.uri = input.uri ?? null;
    this.artworkUrl = input.artworkUrl ?? null;
    this.source = input.source ?? null;
    this.requester = input.requester;
    this.extra = Object.freeze({ ...input.extra });
  }

  /**
   * Creates an unresolved track.
   *
   * @param input - Song details. Only `title` is required.
   * @returns The unresolved track.
   * @throws {ValidationError} When `title` is empty.
   */
  static create(input: UnresolvedTrackInput): UnresolvedTrack {
    if (!isNonEmptyString(input.title)) {
      throw new ValidationError("title", "an unresolved track needs a title");
    }
    return new UnresolvedTrack(input);
  }

  /**
   * Returns a copy with a different requester.
   *
   * @param requester - New requester.
   * @returns A new unresolved track.
   */
  withRequester(requester: Requester | undefined): UnresolvedTrack {
    return new UnresolvedTrack({ ...this.toInput(), requester });
  }

  /**
   * The search text used when nothing better (like an ISRC) is available.
   *
   * @returns `title author`, or just the title.
   */
  searchText(): string {
    return this.author ? `${this.title} ${this.author}` : this.title;
  }

  /**
   * Turns the track back into creation input, for persistence and copies.
   *
   * @returns The input.
   */
  toInput(): UnresolvedTrackInput {
    const input: UnresolvedTrackInput = { title: this.title, extra: { ...this.extra } };
    if (this.author !== null) input.author = this.author;
    if (this.durationMs !== null) input.durationMs = this.durationMs;
    if (this.isrc !== null) input.isrc = this.isrc;
    if (this.uri !== null) input.uri = this.uri;
    if (this.artworkUrl !== null) input.artworkUrl = this.artworkUrl;
    if (this.source !== null) input.source = this.source;
    if (this.requester !== undefined) input.requester = this.requester;
    return input;
  }
}
