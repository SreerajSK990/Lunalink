import type { ErrorCode } from "./ErrorCode.js";

/**
 * Options shared by every Lunalink error.
 */
export interface LunalinkErrorOptions {
  /** The error that caused this one. */
  cause?: unknown;
  /** Extra context, such as the guild or node id. Shown in logs, never parsed by Lunalink. */
  details?: Readonly<Record<string, unknown>>;
}

/**
 * Base class for every error Lunalink throws. Check `code` rather than the message: messages can
 * be reworded, codes can't.
 *
 * @example
 * ```ts
 * try {
 *   await player.play(track);
 * } catch (error) {
 *   if (error instanceof LunalinkError && error.code === ErrorCode.NoNodesAvailable) {
 *     await interaction.reply("No music server is online right now.");
 *   }
 * }
 * ```
 */
export class LunalinkError extends Error {
  /** Stable code for this kind of failure. */
  readonly code: ErrorCode;
  /** Extra context for logs. */
  readonly details: Readonly<Record<string, unknown>>;

  /**
   * Creates an error.
   *
   * @param code - Stable error code.
   * @param message - What went wrong, written for the bot developer.
   * @param options - Cause and extra details.
   */
  constructor(code: ErrorCode, message: string, options: LunalinkErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = options.details ?? {};
  }
}
