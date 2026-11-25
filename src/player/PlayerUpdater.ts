import { ErrorCode } from "../errors/ErrorCode.js";
import { LunalinkError } from "../errors/LunalinkError.js";
import { RestError } from "../errors/RestError.js";
import type { Node } from "../node/Node.js";
import type { ApiNodeLinkUpdatePlayer, ApiPlayer, ApiUpdatePlayer } from "../protocol/index.js";

/**
 * Sends player updates to the node one at a time, in the order they were made. Without this,
 * a pause sent right after a play could reach the server first.
 */
export class PlayerUpdater {
  readonly #guildId: string;
  readonly #node: () => Node;
  #chain: Promise<unknown> = Promise.resolve();

  /**
   * Creates the updater.
   *
   * @param guildId - Guild id.
   * @param node - Returns the player's current node.
   */
  constructor(guildId: string, node: () => Node) {
    this.#guildId = guildId;
    this.#node = node;
  }

  /**
   * Sends an update.
   *
   * @param body - Fields to change. NodeLink-only fields are allowed.
   * @param noReplace - Ignore a new track when one is playing.
   * @returns The player as the node sees it after the update.
   */
  update(body: ApiNodeLinkUpdatePlayer, noReplace = false): Promise<ApiPlayer> {
    return this.#enqueue(() =>
      this.#node().rest.updatePlayer(this.#guildId, body as ApiUpdatePlayer, noReplace),
    );
  }

  /**
   * Destroys the player on the node. A 404 (already gone) counts as success.
   *
   * @param node - Node to destroy it on. Defaults to the current one.
   * @returns Resolves once the node confirmed, or the player was already gone.
   */
  destroy(node: Node = this.#node()): Promise<void> {
    return this.#enqueue(async () => {
      try {
        await node.rest.destroyPlayer(this.#guildId);
      } catch (error) {
        if (error instanceof RestError && error.status === 404) return;
        if (error instanceof LunalinkError && error.code === ErrorCode.NodeNotReady) return;
        throw error;
      }
    });
  }

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#chain.then(task, task);
    this.#chain = run.catch(() => undefined);
    return run;
  }
}
