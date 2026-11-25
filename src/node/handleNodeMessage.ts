import type { NodeDriver, NodeStats } from "../drivers/types.js";
import type { DebugLevel } from "../events/DebugEvent.js";
import type { ApiEventBase, ApiPlayerState } from "../protocol/index.js";
import { isRecord } from "../utils/guards.js";
import { parseJson } from "../utils/json.js";
import type { TypedEmitter } from "../events/TypedEmitter.js";
import type { NodeEvents } from "./NodeEvents.js";

/**
 * The parts of a node that message handling needs.
 */
export interface MessageTarget {
  /** Where events are emitted. */
  readonly events: TypedEmitter<NodeEvents>;
  /** Translates the server's wire format. */
  readonly driver: NodeDriver;
}

/**
 * Callbacks the node passes in so this function can update its private state.
 */
export interface MessageCallbacks {
  /**
   * A `ready` message arrived.
   *
   * @param sessionId - New session id.
   */
  onReady(sessionId: string): void;
  /**
   * Stats arrived.
   *
   * @param stats - Normalized stats.
   */
  onStats(stats: NodeStats): void;
  /**
   * Reports something worth logging.
   *
   * @param level - Severity.
   * @param message - What happened.
   * @param data - Extra values.
   */
  debug(level: DebugLevel, message: string, data?: Record<string, unknown>): void;
}

/**
 * Parses one WebSocket message from a node and emits the matching node event. Malformed
 * messages are logged and dropped; they never throw.
 *
 * @param node - The node, or anything with its events and driver.
 * @param data - Raw message.
 * @param callbacks - Hooks into the node's private state.
 */
export function handleNodeMessage(
  node: MessageTarget,
  data: string | Uint8Array,
  callbacks: MessageCallbacks,
): void {
  if (typeof data !== "string") {
    callbacks.debug("trace", "Ignored a binary message on the gateway socket");
    return;
  }
  const parsed = parseJson(data);
  if (!parsed.ok || !isRecord(parsed.value)) {
    callbacks.debug("warn", "Dropped a message that isn't a JSON object", {
      data: data.slice(0, 200),
    });
    return;
  }
  const message = parsed.value;
  node.events.emit("raw", message);

  switch (message["op"]) {
    case "ready": {
      const sessionId = message["sessionId"];
      if (typeof sessionId !== "string") {
        callbacks.debug("warn", "Ready message without a session id");
        return;
      }
      const resumed = message["resumed"] === true;
      callbacks.onReady(sessionId);
      callbacks.debug(
        "info",
        resumed ? `Resumed session ${sessionId}` : `New session ${sessionId}`,
      );
      node.events.emit("ready", resumed, sessionId);
      return;
    }
    case "playerUpdate": {
      const guildId = message["guildId"];
      const state = message["state"];
      if (typeof guildId === "string" && isRecord(state)) {
        node.events.emit("playerUpdate", guildId, state as unknown as ApiPlayerState);
      }
      return;
    }
    case "stats": {
      const stats = node.driver.normalizeStats(message);
      if (stats) {
        callbacks.onStats(stats);
        node.events.emit("stats", stats);
      }
      return;
    }
    case "event": {
      if (typeof message["type"] !== "string" || typeof message["guildId"] !== "string") {
        callbacks.debug("warn", "Event without a type or guild id", { message });
        return;
      }
      node.events.emit("event", node.driver.normalizeEvent(message as unknown as ApiEventBase));
      return;
    }
    default:
      callbacks.debug("trace", `Unhandled op ${String(message["op"])}`);
  }
}
