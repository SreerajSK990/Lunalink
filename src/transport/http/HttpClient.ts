import { ErrorCode } from "../../errors/ErrorCode.js";
import { RestError } from "../../errors/RestError.js";
import { parseJson } from "../../utils/json.js";
import { parseRetryAfter } from "./retryAfter.js";

/**
 * HTTP methods the nodes use.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A `fetch` compatible function. Pass your own to add a proxy or to mock requests in tests.
 */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Settings for {@link HttpClient}.
 */
export interface HttpClientOptions {
  /** Base address, for example `http://localhost:2333`. No trailing slash. */
  baseUrl: string;
  /** Server password, sent as `Authorization`. */
  password: string;
  /** Value of the `User-Agent` and `Client-Name` headers. */
  clientName: string;
  /** Request timeout in milliseconds. */
  timeoutMs: number;
  /** How many times a 429 is retried when the server's `Retry-After` is short enough. */
  maxRateLimitRetries: number;
  /** Longest `Retry-After` that is waited out automatically, in milliseconds. */
  maxRetryAfterMs: number;
  /** `fetch` to use. Defaults to the global one. */
  fetch?: FetchLike;
  /** Extra headers sent with every request. */
  headers?: Readonly<Record<string, string>>;
}

/**
 * Options for a single request.
 */
export interface RequestOptions {
  /** Query parameters. `undefined` values are left out. */
  query?: Readonly<Record<string, string | number | boolean | undefined>>;
  /** JSON body. */
  body?: unknown;
  /** Cancels the request. */
  signal?: AbortSignal;
  /** Overrides the client's timeout for this request. */
  timeoutMs?: number;
}

/**
 * What came back from a request.
 */
export interface HttpResponse<T> {
  /** HTTP status. */
  status: number;
  /** Response headers. */
  headers: Headers;
  /** Parsed JSON body, the raw text when it isn't JSON, or `undefined` when empty. */
  data: T;
}

/**
 * Small REST client for Lavalink and NodeLink. It adds auth headers, applies a timeout, parses
 * JSON, waits out short rate limits, and turns every failure into a {@link RestError}.
 */
export class HttpClient {
  readonly #options: HttpClientOptions;
  readonly #fetch: FetchLike;

  /**
   * Creates a client.
   *
   * @param options - Address, password and limits.
   */
  constructor(options: HttpClientOptions) {
    this.#options = options;
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  /**
   * Sends a request and returns only the body.
   *
   * @param method - HTTP method.
   * @param path - Path starting with `/`, for example `/v4/info`.
   * @param options - Query, body, signal and timeout.
   * @returns The parsed body. The type is the caller's promise about the server's answer.
   * @throws {RestError} On an error status, timeout, rate limit or network failure.
   */
  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.requestWithResponse<T>(method, path, options);
    return response.data;
  }

  /**
   * Sends a request and returns status, headers and body. Used where headers matter, such as
   * spotting NodeLink by its `IamNodelink` header.
   *
   * @param method - HTTP method.
   * @param path - Path starting with `/`.
   * @param options - Query, body, signal and timeout.
   * @returns Status, headers and parsed body.
   * @throws {RestError} On an error status, timeout, rate limit or network failure.
   */
  async requestWithResponse<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#send<T>(method, path, options);
      } catch (error) {
        if (!this.#shouldRetry(error, attempt)) throw error;
        await sleep(error.retryAfterMs ?? 0, options.signal);
      }
    }
  }

  #shouldRetry(error: unknown, attempt: number): error is RestError {
    return (
      error instanceof RestError &&
      error.code === ErrorCode.RestRateLimited &&
      attempt < this.#options.maxRateLimitRetries &&
      error.retryAfterMs !== undefined &&
      error.retryAfterMs <= this.#options.maxRetryAfterMs
    );
  }

  async #send<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<HttpResponse<T>> {
    const timeoutMs = options.timeoutMs ?? this.#options.timeoutMs;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;
    const init: RequestInit = {
      method,
      headers: this.#headers(options.body !== undefined),
      signal,
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);

    let response: Response;
    try {
      response = await this.#fetch(this.#url(path, options.query), init);
    } catch (error) {
      throw this.#networkError(
        method,
        path,
        error,
        timeoutSignal.aborted,
        timeoutMs,
        options.signal,
      );
    }

    const data = await readBody(response);
    if (!response.ok) throw this.#statusError(method, path, response, data);
    return { status: response.status, headers: response.headers, data: data as T };
  }

  #headers(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.#options.headers,
      Authorization: this.#options.password,
      "User-Agent": this.#options.clientName,
      "Client-Name": this.#options.clientName,
      Accept: "application/json",
    };
    if (hasBody) headers["Content-Type"] = "application/json";
    return headers;
  }

  #url(path: string, query: RequestOptions["query"]): string {
    const url = new URL(path, `${this.#options.baseUrl}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  #networkError(
    method: HttpMethod,
    path: string,
    cause: unknown,
    timedOut: boolean,
    timeoutMs: number,
    userSignal: AbortSignal | undefined,
  ): RestError {
    if (userSignal?.aborted) {
      return new RestError(ErrorCode.Aborted, `${method} ${path} was cancelled`, {
        method,
        path,
        status: null,
        cause,
      });
    }
    if (timedOut) {
      return new RestError(
        ErrorCode.RestTimeout,
        `${method} ${path} got no answer in ${timeoutMs} ms`,
        {
          method,
          path,
          status: null,
          cause,
        },
      );
    }
    return new RestError(
      ErrorCode.RestRequestFailed,
      `${method} ${path} failed: ${describe(cause)}`,
      {
        method,
        path,
        status: null,
        cause,
      },
    );
  }

  #statusError(method: HttpMethod, path: string, response: Response, body: unknown): RestError {
    const serverMessage = extractMessage(body);
    const message = `${method} ${path} returned ${response.status}${serverMessage ? `: ${serverMessage}` : ""}`;
    const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
    return new RestError(RestError.codeForStatus(response.status), message, {
      method,
      path,
      status: response.status,
      body,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    });
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text.length === 0) return undefined;
  const parsed = parseJson(text);
  return parsed.ok ? parsed.value : text;
}

function extractMessage(body: unknown): string | undefined {
  if (typeof body === "string") return body.slice(0, 200);
  if (typeof body === "object" && body !== null && "message" in body) {
    const { message } = body;
    if (typeof message === "string") return message;
  }
  return undefined;
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
    return `${error.message}${cause}`;
  }
  return String(error);
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
