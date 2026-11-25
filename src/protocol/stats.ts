/**
 * Server memory usage in bytes.
 */
export interface ApiMemoryStats {
  /** Free memory. */
  free: number;
  /** Used memory. */
  used: number;
  /** Allocated memory. */
  allocated: number;
  /** Memory that could still be reserved. */
  reservable: number;
}

/**
 * Lavalink CPU usage.
 */
export interface ApiLavalinkCpuStats {
  /** CPU cores on the machine. */
  cores: number;
  /** Load of the whole machine, 0 to 1. */
  systemLoad: number;
  /** Load caused by Lavalink, 0 to 1. */
  lavalinkLoad: number;
}

/**
 * Audio frame counts for the last minute.
 */
export interface ApiFrameStats {
  /** Frames sent to Discord. */
  sent: number;
  /** Frames that were empty. */
  nulled: number;
  /** Expected frames minus sent frames. Above 0 means audio stuttered. */
  deficit: number;
}

/**
 * Lavalink statistics, sent every minute as a `stats` message and returned by `GET /v4/stats`.
 */
export interface ApiLavalinkStats {
  /** Players on the server. */
  players: number;
  /** Players that are playing something. */
  playingPlayers: number;
  /** Server uptime in milliseconds. */
  uptime: number;
  /** Memory usage. */
  memory: ApiMemoryStats;
  /** CPU usage. */
  cpu: ApiLavalinkCpuStats;
  /** Frame counts. `null` when no players exist, and always missing from `GET /v4/stats`. */
  frameStats?: ApiFrameStats | null;
}
