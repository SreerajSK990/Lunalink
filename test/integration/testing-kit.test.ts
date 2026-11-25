import { describe, expect, it } from "vitest";
import { checkNodeConformance, createHarness, MockNode, track } from "../../src/testing/index.js";

describe("lunalink/testing", () => {
  it.each(["lavalink", "nodelink"] as const)(
    "passes the conformance check on a %s mock",
    async (kind) => {
      const node = await new MockNode({ kind }).start();
      try {
        const report = await checkNodeConformance({
          node: { host: "127.0.0.1", port: node.port, password: node.password },
        });
        expect(report.checks.filter((check) => !check.ok)).toEqual([]);
        expect(report.passed).toBe(true);
      } finally {
        await node.stop();
      }
    },
  );

  it("reports a wrong password as a failed check", async () => {
    const node = await new MockNode().start();
    try {
      const report = await checkNodeConformance({
        node: {
          host: "127.0.0.1",
          port: node.port,
          password: "wrong",
          reconnect: { maxAttempts: 0 },
        },
      });
      expect(report.passed).toBe(false);
    } finally {
      await node.stop();
    }
  });

  it("gives a connected client that can play", async () => {
    const harness = await createHarness();
    try {
      harness.node.loadTracks = () => ({ loadType: "search", data: [track("a")] });
      const result = await harness.lunalink.search("song");
      const player = harness.lunalink.players.create({
        guildId: "81384788765712384",
        voiceChannelId: "81384788862181376",
      });
      await player.connect();
      const first = result.tracks[0];
      if (!first) throw new Error("no track");
      expect(await player.play(first)).toBe(true);
      expect(harness.discord.sent[0]?.d.channel_id).toBe("81384788862181376");
    } finally {
      await harness.stop();
    }
  });
});
