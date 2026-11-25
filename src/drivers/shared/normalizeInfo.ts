import { isRecord } from "../../utils/guards.js";
import type { NodeInfo, NodeKind } from "../types.js";
import { normalizeVersion } from "./normalizeVersion.js";
import { readArray, readNumber, readRecord, readString, readStringArray } from "./read.js";

/**
 * Normalizes `/v4/info` from either server.
 *
 * @param raw - Response body.
 * @param kind - Which server sent it.
 * @param runtimeKey - Field holding the runtime version: `jvm` or `node`.
 * @returns Normalized info.
 * @throws {TypeError} When the body has no `version` object or source list, which means the
 *   address isn't a Lavalink v4 or NodeLink server.
 */
export function normalizeInfo(raw: unknown, kind: NodeKind, runtimeKey: string): NodeInfo {
  if (!isRecord(raw) || !readRecord(raw, "version") || !Array.isArray(raw["sourceManagers"])) {
    throw new TypeError("The /v4/info response doesn't look like Lavalink v4 or NodeLink.");
  }
  return {
    kind,
    version: normalizeVersion(raw["version"]),
    buildTime: readNumber(raw, "buildTime"),
    runtime: readString(raw, runtimeKey) ?? "unknown",
    sourceManagers: readStringArray(raw, "sourceManagers"),
    filters: readStringArray(raw, "filters"),
    plugins: readArray(raw, "plugins").flatMap((plugin) => {
      const name = readString(plugin, "name");
      return name === null ? [] : [{ name, version: readString(plugin, "version") ?? "unknown" }];
    }),
    raw,
  };
}
