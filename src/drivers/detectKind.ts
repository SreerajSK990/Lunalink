import { isRecord } from "../utils/guards.js";
import type { NodeKind } from "./types.js";

/**
 * Works out whether a node runs Lavalink or NodeLink from its `/v4/info` response. NodeLink
 * marks every response with an `IamNodelink: true` header and puts `isNodelink: true` in the
 * info body (`src/api/index.ts` and `src/api/info.ts` in NodeLink). Lavalink does neither.
 *
 * @param headers - Response headers.
 * @param body - Parsed response body.
 * @returns The server kind.
 */
export function detectKind(headers: Headers, body: unknown): NodeKind {
  if (headers.get("iamnodelink")?.toLowerCase() === "true") return "nodelink";
  if (isRecord(body) && body["isNodelink"] === true) return "nodelink";
  return "lavalink";
}
