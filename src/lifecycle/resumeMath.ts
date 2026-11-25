/**
 * How resumed players pick their position.
 *
 * - `auto`: decide per player from what the client knows (the default).
 * - `listener`: always go back to where listeners stopped hearing audio.
 * - `server`: always trust the server's position.
 * - `snapshot`: always rebuild from the saved snapshot.
 */
export type ResumeStrategy = "auto" | "listener" | "server" | "snapshot";

/**
 * What happened to a player during a resume.
 *
 * - `seamless`: nothing was needed; listeners heard no gap.
 * - `rejoined`: voice was joined again, the server kept the track.
 * - `advanced`: the song ended while we were away; playback continued with the next one.
 * - `rebuilt`: the server lost the player; it was rebuilt from what Lunalink had.
 * - `held`: nobody was listening, so the player was rejoined paused.
 */
export type ResumeMode = "seamless" | "rejoined" | "advanced" | "rebuilt" | "held";

/**
 * Details of the `playerResumed` event.
 */
export interface ResumeInfo {
  /** What happened. */
  mode: ResumeMode;
  /** Why, for example `voice-dropped-seek-back` or `stream-rejoin`. */
  reason: string;
  /** How long listeners heard nothing, in milliseconds, as far as Lunalink can tell. */
  gapMs: number;
  /** `low` when the saved position was stale and the result is a best guess. */
  confidence: "high" | "low";
}

/**
 * Drifts smaller than this aren't worth an audible seek.
 */
export const SEEK_THRESHOLD_MS = 1_500;

/**
 * Picks how far before the listener position to restart, so listeners get some context.
 *
 * @param gapMs - How long the audio was gone.
 * @param setting - A fixed lead, or `auto`.
 * @returns Lead in milliseconds.
 */
export function rewindLead(gapMs: number, setting: number | "auto"): number {
  if (setting !== "auto") return Math.max(0, setting);
  if (gapMs < 3_000) return 0;
  if (gapMs <= 30_000) return 2_000;
  return 3_000;
}

/**
 * Picks the session timeout from past downtimes: twice the 95th percentile, between 60 and 900
 * seconds, or 300 before there's any history.
 *
 * @param downtimesMs - Measured downtimes in milliseconds.
 * @returns Timeout in seconds.
 */
export function autoTimeoutSeconds(downtimesMs: readonly number[]): number {
  if (downtimesMs.length === 0) return 300;
  const sorted = [...downtimesMs].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[Math.max(0, index)] ?? 0;
  return Math.min(900, Math.max(60, Math.round((p95 * 2) / 1_000)));
}

/**
 * Input of {@link listenerPosition}.
 */
export interface ListenerPositionInput {
  /** Saved position. */
  position: number;
  /** When it was saved, in Unix milliseconds. */
  at: number;
  /** When the process was last known alive, or `null`. */
  lastAliveAt: number | null;
  /** The server's position when it still has the player, or `null`. */
  serverPosition: number | null;
}

/**
 * Works out where listeners stopped hearing audio: the saved position plus the time the process
 * stayed alive after it, but never past the server's position.
 *
 * @param input - Saved position and times.
 * @returns Position in milliseconds.
 */
export function listenerPosition(input: ListenerPositionInput): number {
  const alive = Math.max(0, (input.lastAliveAt ?? input.at) - input.at);
  const estimate = input.position + alive;
  return input.serverPosition === null ? estimate : Math.min(input.serverPosition, estimate);
}

/**
 * Picks the position to restart at: the listener position minus the lead, never before 0.
 *
 * @param listener - Listener position.
 * @param gapMs - How long the audio was gone.
 * @param lead - Lead setting.
 * @returns Position in milliseconds.
 */
export function restartPosition(listener: number, gapMs: number, lead: number | "auto"): number {
  return Math.max(0, Math.round(listener - rewindLead(gapMs, lead)));
}
