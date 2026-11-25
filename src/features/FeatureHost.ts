import type { Node } from "../node/Node.js";
import type { ApiNodeLinkUpdatePlayer } from "../protocol/index.js";
import type { Track } from "../track/Track.js";

/**
 * What player features need from their player.
 */
export interface FeatureHost {
  /** Guild id. */
  readonly guildId: string;
  /**
   * The node the player is on now.
   *
   * @returns The node.
   */
  node(): Node;
  /**
   * The track that's playing.
   *
   * @returns The track, or `null`.
   */
  currentTrack(): Track | null;
  /**
   * Sends a player update through the player's ordered update queue.
   *
   * @param body - Fields to change. NodeLink-only fields are allowed.
   */
  update(body: ApiNodeLinkUpdatePlayer): Promise<void>;
}
