import { ErrorCode } from "./ErrorCode.js";
import { LunalinkError, type LunalinkErrorOptions } from "./LunalinkError.js";

/**
 * You called something the node can't do, for example lyrics on a Lavalink server without a
 * lyrics plugin. Use `player.supports(capability)` beforehand if you'd rather check than catch.
 */
export class UnsupportedFeatureError extends LunalinkError {
  /** The capability that was missing, for example `lyrics`. */
  readonly capability: string;
  /** Id of the node that lacks it. */
  readonly nodeId: string;

  /**
   * Creates the error.
   *
   * @param capability - Missing capability.
   * @param nodeId - Node that lacks it.
   * @param hint - What the user can do about it, such as which plugin to install.
   * @param options - Cause and extra details.
   */
  constructor(
    capability: string,
    nodeId: string,
    hint?: string,
    options: LunalinkErrorOptions = {},
  ) {
    const message = `Node "${nodeId}" does not support "${capability}".${hint ? ` ${hint}` : ""}`;
    super(ErrorCode.UnsupportedFeature, message, {
      ...options,
      details: { ...options.details, capability, nodeId },
    });
    this.capability = capability;
    this.nodeId = nodeId;
  }
}
