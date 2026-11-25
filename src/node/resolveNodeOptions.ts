import { ValidationError } from "../errors/ValidationError.js";
import { isNonEmptyString } from "../utils/guards.js";
import type { NodeOptions, ResolvedNodeOptions } from "./NodeOptions.js";

/**
 * Applies defaults to node options and checks them.
 *
 * @param options - What the user passed.
 * @param field - Where it came from, for error messages, for example `nodes[0]`.
 * @returns Complete options.
 * @throws {ValidationError} When host, port or password is missing or wrong.
 */
export function resolveNodeOptions(options: NodeOptions, field: string): ResolvedNodeOptions {
  if (!isNonEmptyString(options.host)) {
    throw new ValidationError(`${field}.host`, "must be a non-empty string", true);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new ValidationError(`${field}.port`, "must be a whole number from 1 to 65535", true);
  }
  if (typeof options.password !== "string") {
    throw new ValidationError(`${field}.password`, "must be a string", true);
  }
  const reconnect = options.reconnect ?? {};
  const resolved: ResolvedNodeOptions = {
    id: options.id ?? `${options.host}:${options.port}`,
    host: options.host,
    port: options.port,
    password: options.password,
    secure: options.secure ?? false,
    type: options.type ?? "auto",
    regions: (options.regions ?? []).map((region) => region.toLowerCase()),
    priority: options.priority ?? 0,
    sessionId: options.sessionId,
    requestTimeoutMs: options.requestTimeoutMs ?? 10_000,
    reconnect: {
      baseDelayMs: reconnect.baseDelayMs ?? 1_000,
      maxDelayMs: reconnect.maxDelayMs ?? 30_000,
      maxAttempts: reconnect.maxAttempts ?? Number.POSITIVE_INFINITY,
    },
    silenceTimeoutMs: options.silenceTimeoutMs ?? 150_000,
    assumeCapabilities: options.assumeCapabilities ?? [],
    headers: options.headers ?? {},
  };
  if (
    resolved.reconnect.baseDelayMs <= 0 ||
    resolved.reconnect.maxDelayMs < resolved.reconnect.baseDelayMs
  ) {
    throw new ValidationError(`${field}.reconnect`, "needs 0 < baseDelayMs <= maxDelayMs", true);
  }
  return resolved;
}

/**
 * Builds a node's REST base address.
 *
 * @param options - Resolved node options.
 * @returns For example `http://localhost:2333`.
 */
export function restBaseUrl(options: ResolvedNodeOptions): string {
  return `${options.secure ? "https" : "http"}://${options.host}:${options.port}`;
}

/**
 * Builds a node's WebSocket address for a path.
 *
 * @param options - Resolved node options.
 * @param path - Path starting with `/`.
 * @returns For example `ws://localhost:2333/v4/websocket`.
 */
export function socketUrl(options: ResolvedNodeOptions, path: string): string {
  return `${options.secure ? "wss" : "ws"}://${options.host}:${options.port}${path}`;
}
