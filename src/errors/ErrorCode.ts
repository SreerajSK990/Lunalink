/**
 * Every error code Lunalink can throw. Codes never change meaning between versions, so they're
 * safe to switch on.
 */
export const ErrorCode = {
  InvalidOption: "INVALID_OPTION",
  InvalidArgument: "INVALID_ARGUMENT",
  NodeNotFound: "NODE_NOT_FOUND",
  NoNodesAvailable: "NO_NODES_AVAILABLE",
  NodeNotReady: "NODE_NOT_READY",
  Unauthorized: "UNAUTHORIZED",
  RestRequestFailed: "REST_REQUEST_FAILED",
  RestTimeout: "REST_TIMEOUT",
  RestRateLimited: "REST_RATE_LIMITED",
  UnsupportedFeature: "UNSUPPORTED_FEATURE",
  PlayerNotFound: "PLAYER_NOT_FOUND",
  PlayerDestroyed: "PLAYER_DESTROYED",
  VoiceConnectionTimeout: "VOICE_CONNECTION_TIMEOUT",
  TrackLoadFailed: "TRACK_LOAD_FAILED",
  PluginFailed: "PLUGIN_FAILED",
  PluginConflict: "PLUGIN_CONFLICT",
  StoreFailed: "STORE_FAILED",
  Aborted: "ABORTED",
} as const;

/**
 * One of the values of {@link ErrorCode}.
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
