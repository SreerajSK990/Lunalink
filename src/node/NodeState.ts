/**
 * Where a node's connection stands.
 *
 * - `idle`: created, `connect()` not called yet.
 * - `connecting`: first connection in progress.
 * - `ready`: connected and the server sent `ready`. Players can be used.
 * - `reconnecting`: the connection dropped and Lunalink is trying again.
 * - `disconnected`: gave up reconnecting, or was disconnected on purpose.
 * - `destroyed`: removed for good.
 */
export type NodeState =
  "idle" | "connecting" | "ready" | "reconnecting" | "disconnected" | "destroyed";
