/**
 * Body of `PATCH /v4/sessions/{sessionId}`.
 */
export interface ApiUpdateSession {
  /** Keep the session alive after the client disconnects, so it can be resumed. */
  resuming?: boolean;
  /** How long the server keeps a disconnected session, in seconds. Lavalink defaults to 60. */
  timeout?: number;
}

/**
 * Response of `PATCH /v4/sessions/{sessionId}`.
 */
export interface ApiSession {
  /** Whether resuming is enabled. */
  resuming: boolean;
  /** Resume timeout in seconds. */
  timeout: number;
}
