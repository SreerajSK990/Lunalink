import type { ApiMemoryStats } from "../stats.js";

/**
 * NodeLink CPU usage. Note the `nodelinkLoad` field where Lavalink has `lavalinkLoad`.
 */
export interface ApiNodeLinkCpuStats {
  /** CPU cores on the machine. */
  cores: number;
  /** Load of the whole machine, 0 to 1. */
  systemLoad: number;
  /** Load caused by NodeLink, 0 to 1. */
  nodelinkLoad: number;
}

/**
 * NodeLink frame counts. NodeLink also reports `expected`.
 */
export interface ApiNodeLinkFrameStats {
  /** Frames sent to Discord. */
  sent?: number;
  /** Frames that were empty. */
  nulled?: number;
  /** Expected frames minus sent frames. */
  deficit?: number;
  /** Frames that should have been sent. */
  expected?: number;
}

/**
 * NodeLink statistics.
 *
 * Source: `PerformanC/NodeLink` `src/typings/api/stats.types.ts`.
 */
export interface ApiNodeLinkStats {
  /** Players on the server. */
  players: number;
  /** Players that are playing something. */
  playingPlayers: number;
  /** Server uptime in milliseconds. */
  uptime: number;
  /** Memory usage. */
  memory: ApiMemoryStats;
  /** CPU usage. */
  cpu: ApiNodeLinkCpuStats;
  /** Frame counts. */
  frameStats?: ApiNodeLinkFrameStats | null;
  /** Request, source and playback counters. Present on newer NodeLink builds. */
  detailedStats?: Record<string, unknown>;
}
