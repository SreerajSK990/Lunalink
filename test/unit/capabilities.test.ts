import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../src/capabilities/resolveCapabilities.js";
import { UnsupportedFeatureError } from "../../src/errors/UnsupportedFeatureError.js";
import { LavalinkDriver } from "../../src/drivers/lavalink/LavalinkDriver.js";
import { NodeLinkDriver } from "../../src/drivers/nodelink/NodeLinkDriver.js";
import { lavalinkInfo, nodeLinkInfo } from "../mock/fixtures.js";

function contextFor(kind: "lavalink" | "nodelink", raw: unknown) {
  const info = (kind === "lavalink" ? new LavalinkDriver() : new NodeLinkDriver()).normalizeInfo(
    raw,
  );
  return {
    kind,
    plugins: info.plugins.map((plugin) => plugin.name),
    sourceManagers: info.sourceManagers,
    filters: info.filters,
    version: info.version,
    raw,
  } as const;
}

describe("resolveCapabilities", () => {
  it("lists filters, sources and plugins with prefixes", () => {
    const caps = resolveCapabilities(
      "main",
      contextFor("lavalink", lavalinkInfo([{ name: "lavasrc-plugin", version: "4" }])),
    );
    expect(caps.has("filter:timescale")).toBe(true);
    expect(caps.has("source:youtube")).toBe(true);
    expect(caps.has("plugin:lavasrc-plugin")).toBe(true);
    expect(caps.has("lyrics")).toBe(false);
  });

  it("maps Lavalink plugins to features", () => {
    const caps = resolveCapabilities(
      "main",
      contextFor(
        "lavalink",
        lavalinkInfo([
          { name: "lavalyrics-plugin", version: "1" },
          { name: "sponsorblock-plugin", version: "1" },
          { name: "lavasearch-plugin", version: "1" },
          { name: "lavadspx-plugin", version: "1" },
        ]),
      ),
    );
    for (const capability of [
      "lyrics",
      "lyrics:live",
      "lyrics:lavalyrics",
      "sponsorblock",
      "sponsorblock:plugin",
      "chapters",
      "search:lavasearch",
      "pluginFilter:lavadspx",
      "voice:dave",
    ]) {
      expect(caps.has(capability), capability).toBe(true);
    }
  });

  it("only gives DAVE to Lavalink 4.2 and later", () => {
    const old = lavalinkInfo();
    old.version = { semver: "4.1.2", major: 4, minor: 1, patch: 2, preRelease: null };
    expect(resolveCapabilities("old", contextFor("lavalink", old)).has("voice:dave")).toBe(false);
  });

  it("gives NodeLink its built-in features", () => {
    const caps = resolveCapabilities("nl", contextFor("nodelink", nodeLinkInfo()));
    expect(caps.has("lyrics:nodelink")).toBe(true);
    expect(caps.has("sponsorblock:nodelink")).toBe(true);
    expect(caps.has("nodelink:mixer")).toBe(true);
    expect(caps.has("nodelink:sourceHealth")).toBe(false);
    expect(caps.has("sponsorblock:plugin")).toBe(false);
  });

  it("adds assumed capabilities and plugin rules", () => {
    const caps = resolveCapabilities(
      "main",
      contextFor("lavalink", lavalinkInfo()),
      [() => ["custom:thing"]],
      ["lyrics"],
    );
    expect(caps.has("custom:thing")).toBe(true);
    expect(caps.has("lyrics")).toBe(true);
  });

  it("require throws an UnsupportedFeatureError with a hint", () => {
    const caps = resolveCapabilities("main", contextFor("lavalink", lavalinkInfo()));
    expect(() => {
      caps.require("lyrics", "Install LavaLyrics.");
    }).toThrow(UnsupportedFeatureError);
  });
});
