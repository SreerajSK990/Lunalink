/**
 * Tell Lunalink about your own types by augmenting this interface. Every key is optional.
 *
 * - `requester`: the type you store on tracks, for example a discord.js `User`.
 * - `queue`: your queue class, when a plugin replaces the queue.
 * - `player`: your player class, when you extend `Player`.
 *
 * @example
 * ```ts
 * import type { User } from "discord.js";
 *
 * declare module "lunalink" {
 *   interface Register {
 *     requester: User;
 *   }
 * }
 * ```
 */
export interface Register {}

/**
 * The requester type from {@link Register}, or `unknown` when it isn't set.
 */
export type Requester = Register extends { requester: infer Value } ? Value : unknown;
