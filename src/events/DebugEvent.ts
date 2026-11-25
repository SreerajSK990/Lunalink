/**
 * How much a debug message matters.
 */
export type DebugLevel = "trace" | "info" | "warn" | "error";

/**
 * A structured log line. Lunalink never prints anything itself; listen to `debug` to see these.
 */
export interface DebugEvent {
  /** Where it came from, for example `node:main` or `player:1234`. */
  scope: string;
  /** How much it matters. */
  level: DebugLevel;
  /** What happened, in one sentence. */
  message: string;
  /** Extra values worth logging. */
  data?: Readonly<Record<string, unknown>>;
}
