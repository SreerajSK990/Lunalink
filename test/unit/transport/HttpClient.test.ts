import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../../src/errors/ErrorCode.js";
import { RestError } from "../../../src/errors/RestError.js";
import { HttpClient, type FetchLike } from "../../../src/transport/http/HttpClient.js";
import { parseRetryAfter } from "../../../src/transport/http/retryAfter.js";

function client(
  fetch: FetchLike,
  overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {},
) {
  return new HttpClient({
    baseUrl: "http://localhost:2333",
    password: "youshallnotpass",
    clientName: "lunalink/0.1.0",
    timeoutMs: 1_000,
    maxRateLimitRetries: 2,
    maxRetryAfterMs: 50,
    fetch,
    ...overrides,
  });
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("HttpClient", () => {
  it("sends auth headers, query and JSON body", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(json(200, { ok: true })));
    const result = await client(fetch).request("PATCH", "/v4/sessions/abc/players/1", {
      query: { noReplace: true, skip: undefined },
      body: { paused: true },
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:2333/v4/sessions/abc/players/1?noReplace=true");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"paused":true}');
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("youshallnotpass");
    expect(headers["Client-Name"]).toBe("lunalink/0.1.0");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns undefined for 204", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await client(fetch).request("DELETE", "/v4/sessions/a/players/1")).toBeUndefined();
  });

  it("returns plain text when the body isn't JSON", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(new Response("4.2.2", { status: 200 })));
    expect(await client(fetch).request("GET", "/version")).toBe("4.2.2");
  });

  it("turns error statuses into RestError with the server message", async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.resolve(json(404, { status: 404, message: "Session not found", path: "/x" })),
    );
    const error = await client(fetch)
      .request("GET", "/x")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RestError);
    expect((error as RestError).code).toBe(ErrorCode.RestRequestFailed);
    expect((error as RestError).status).toBe(404);
    expect((error as RestError).message).toContain("Session not found");
  });

  it("maps 401 to UNAUTHORIZED", async () => {
    const fetch = vi.fn<FetchLike>(() => Promise.resolve(json(401, { message: "Unauthorized" })));
    await expect(client(fetch).request("GET", "/v4/info")).rejects.toMatchObject({
      code: ErrorCode.Unauthorized,
    });
  });

  it("waits out a short Retry-After and retries", async () => {
    const fetch = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(json(429, { message: "slow" }, { "retry-after": "0.01" }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    expect(await client(fetch).request("GET", "/v4/stats")).toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives up on a long Retry-After", async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.resolve(json(429, { message: "slow" }, { "retry-after": "30" })),
    );
    await expect(client(fetch).request("GET", "/v4/stats")).rejects.toMatchObject({
      code: ErrorCode.RestRateLimited,
      retryAfterMs: 30_000,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("reports a timeout", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    await expect(client(fetch, { timeoutMs: 20 }).request("GET", "/v4/info")).rejects.toMatchObject(
      {
        code: ErrorCode.RestTimeout,
      },
    );
  });

  it("reports a cancelled request as ABORTED", async () => {
    const controller = new AbortController();
    const fetch: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    const pending = client(fetch).request("GET", "/v4/info", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: ErrorCode.Aborted });
  });

  it("reports network failures", async () => {
    const fetch = vi.fn<FetchLike>(() =>
      Promise.reject(new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") })),
    );
    await expect(client(fetch).request("GET", "/v4/info")).rejects.toMatchObject({
      code: ErrorCode.RestRequestFailed,
      status: null,
      message: expect.stringContaining("ECONNREFUSED") as unknown,
    });
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds", () => {
    expect(parseRetryAfter("2")).toBe(2_000);
    expect(parseRetryAfter("1.5")).toBe(1_500);
  });

  it("reads HTTP dates", () => {
    const now = Date.parse("2026-11-25T10:00:00Z");
    expect(parseRetryAfter("Wed, 25 Nov 2026 10:00:05 GMT", now)).toBe(5_000);
  });

  it("ignores missing or bad values", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
  });
});
