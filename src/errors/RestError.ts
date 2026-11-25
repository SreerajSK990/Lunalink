import { ErrorCode } from "./ErrorCode.js";
import { LunalinkError, type LunalinkErrorOptions } from "./LunalinkError.js";

/**
 * Describes the request that failed.
 */
export interface RestErrorInit extends LunalinkErrorOptions {
  /** HTTP method. */
  method: string;
  /** Request path, without host or query string. */
  path: string;
  /** HTTP status, or `null` when no response arrived. */
  status: number | null;
  /** Parsed response body, when there was one. */
  body?: unknown;
  /** How long the server asked us to wait, from `Retry-After`, in milliseconds. */
  retryAfterMs?: number;
}

/**
 * A REST call to a node failed: an error status, a timeout, or a network error.
 *
 * The `code` tells you which: `UNAUTHORIZED` for 401 and 403, `REST_RATE_LIMITED` for 429,
 * `REST_TIMEOUT` when no answer came in time, and `REST_REQUEST_FAILED` for everything else.
 */
export class RestError extends LunalinkError {
  /** HTTP method. */
  readonly method: string;
  /** Request path. */
  readonly path: string;
  /** HTTP status, or `null` when no response arrived. */
  readonly status: number | null;
  /** Parsed response body, when there was one. */
  readonly body: unknown;
  /** How long the server asked us to wait before retrying, in milliseconds. */
  readonly retryAfterMs: number | undefined;

  /**
   * Creates a REST error.
   *
   * @param code - Which kind of failure this is.
   * @param message - What went wrong.
   * @param init - The failed request and its response.
   */
  constructor(code: ErrorCode, message: string, init: RestErrorInit) {
    super(code, message, init);
    this.method = init.method;
    this.path = init.path;
    this.status = init.status;
    this.body = init.body;
    this.retryAfterMs = init.retryAfterMs;
  }

  /**
   * Picks the right error code for an HTTP status.
   *
   * @param status - HTTP status.
   * @returns The matching error code.
   */
  static codeForStatus(status: number): ErrorCode {
    if (status === 401 || status === 403) return ErrorCode.Unauthorized;
    if (status === 429) return ErrorCode.RestRateLimited;
    return ErrorCode.RestRequestFailed;
  }
}
