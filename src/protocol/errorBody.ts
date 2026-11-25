/**
 * The JSON body Lavalink returns with a failed REST request.
 */
export interface ApiErrorBody {
  /** When the error happened, in Unix milliseconds. */
  timestamp: number;
  /** HTTP status code. */
  status: number;
  /** HTTP status text, for example `Not Found`. */
  error: string;
  /** Stack trace. Only sent when the request had `trace=true`. */
  trace?: string;
  /** What went wrong. */
  message: string;
  /** Request path. */
  path: string;
}
