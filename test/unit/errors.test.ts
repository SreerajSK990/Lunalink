import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ErrorCode,
  LunalinkError,
  RestError,
  UnsupportedFeatureError,
  ValidationError,
} from "../../src/errors/index.js";
import { LIBRARY_VERSION } from "../../src/version.js";

describe("LunalinkError", () => {
  it("keeps code, details and cause", () => {
    const cause = new Error("socket closed");
    const error = new LunalinkError(ErrorCode.NodeNotReady, "not ready", {
      cause,
      details: { nodeId: "main" },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("LunalinkError");
    expect(error.code).toBe("NODE_NOT_READY");
    expect(error.details).toEqual({ nodeId: "main" });
    expect(error.cause).toBe(cause);
  });
});

describe("RestError", () => {
  it.each([
    [401, ErrorCode.Unauthorized],
    [403, ErrorCode.Unauthorized],
    [429, ErrorCode.RestRateLimited],
    [404, ErrorCode.RestRequestFailed],
    [500, ErrorCode.RestRequestFailed],
  ])("maps status %i to %s", (status, code) => {
    expect(RestError.codeForStatus(status)).toBe(code);
  });

  it("carries the request and response", () => {
    const error = new RestError(ErrorCode.RestRateLimited, "slow down", {
      method: "PATCH",
      path: "/v4/sessions/abc/players/1",
      status: 429,
      retryAfterMs: 2_000,
    });
    expect(error).toBeInstanceOf(LunalinkError);
    expect(error.name).toBe("RestError");
    expect(error.status).toBe(429);
    expect(error.retryAfterMs).toBe(2_000);
  });
});

describe("UnsupportedFeatureError", () => {
  it("names the capability and node", () => {
    const error = new UnsupportedFeatureError("lyrics", "main", "Install LavaLyrics.");
    expect(error.code).toBe(ErrorCode.UnsupportedFeature);
    expect(error.message).toBe('Node "main" does not support "lyrics". Install LavaLyrics.');
    expect(error.details).toEqual({ capability: "lyrics", nodeId: "main" });
  });
});

describe("ValidationError", () => {
  it("uses INVALID_OPTION for options and INVALID_ARGUMENT otherwise", () => {
    expect(new ValidationError("nodes[0].port", "must be 1-65535", true).code).toBe(
      ErrorCode.InvalidOption,
    );
    const argError = new ValidationError("volume", "must be 0-1000");
    expect(argError.code).toBe(ErrorCode.InvalidArgument);
    expect(argError.message).toBe("volume: must be 0-1000");
  });
});

describe("version", () => {
  it("matches package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      version: string;
    };
    expect(LIBRARY_VERSION).toBe(pkg.version);
  });
});
