import {
  builtInSocketFactory,
  CLIENT_NAME,
  Node,
  resolveNodeOptions,
  type FetchLike,
  type NodeOptions,
} from "../index.js";

/**
 * One conformance check.
 */
export interface ConformanceCheck {
  /** What was checked. */
  name: string;
  /** Whether it passed. */
  ok: boolean;
  /** What went wrong, when it failed. */
  detail?: string;
}

/**
 * The result of {@link checkNodeConformance}.
 */
export interface ConformanceReport {
  /** `true` when every check passed. */
  passed: boolean;
  /** Each check, in order. */
  checks: ConformanceCheck[];
}

/**
 * Settings for {@link checkNodeConformance}.
 */
export interface ConformanceOptions {
  /** The server to check. */
  node: NodeOptions;
  /** Identifier for the load tracks check. Defaults to `ytsearch:lunalink`. */
  identifier?: string;
  /** Guild id for the player checks. Defaults to a fixed test id. */
  guildId?: string;
  /** Custom `fetch`. */
  fetch?: FetchLike;
}

/**
 * Checks that a server speaks the Lavalink v4 protocol the way Lunalink expects: info, the
 * WebSocket `ready`, stats, loading, resuming and the player routes. Run it against your own
 * server, a fork, or a custom backend that imitates Lavalink. It creates and deletes one player.
 *
 * @example
 * ```ts
 * const report = await checkNodeConformance({ node: { host: "localhost", port: 2333, password: "youshallnotpass" } });
 * for (const check of report.checks) console.log(check.ok ? "✓" : "✗", check.name, check.detail ?? "");
 * ```
 * @param options - The server and test values.
 * @returns The report.
 */
export async function checkNodeConformance(
  options: ConformanceOptions,
): Promise<ConformanceReport> {
  const checks: ConformanceCheck[] = [];
  const node = new Node(resolveNodeOptions(options.node, "node"), {
    userId: () => "170939974227541168",
    clientName: CLIENT_NAME,
    socketFactory: builtInSocketFactory,
    fetch: options.fetch,
    capabilityRules: () => [],
    debug: () => undefined,
  });
  const check = async (name: string, task: () => Promise<string | null>): Promise<boolean> => {
    try {
      const problem = await task();
      checks.push(problem === null ? { name, ok: true } : { name, ok: false, detail: problem });
      return problem === null;
    } catch (error) {
      checks.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };
  const guildId = options.guildId ?? "81384788765712384";
  try {
    const connected = await check("connects, reads /v4/info and receives ready", async () => {
      await node.connect();
      if (!node.info) return "no info";
      if (!node.sessionId) return "no session id in ready";
      return null;
    });
    if (connected) {
      await check("reports stats", async () =>
        (await node.refreshStats()) ? null : "stats didn't parse",
      );
      await check("loads tracks", async () => {
        const result = await node.rest.loadTracks(options.identifier ?? "ytsearch:lunalink");
        return ["track", "playlist", "search", "empty", "error"].includes(result.loadType)
          ? null
          : `unknown loadType ${result.loadType}`;
      });
      await check("enables resuming", async () => {
        const session = await node.rest.updateSession({ resuming: true, timeout: 60 });
        return session.resuming ? null : "resuming stayed off";
      });
      await check("creates, reads, lists and deletes a player", async () => {
        await node.rest.updatePlayer(guildId, { volume: 42 });
        const player = await node.rest.getPlayer(guildId);
        if (player.volume !== 42) return `volume is ${String(player.volume)}, expected 42`;
        const players = await node.rest.getPlayers();
        if (!players.some((entry) => entry.guildId === guildId))
          return "player missing from the list";
        await node.rest.destroyPlayer(guildId);
        return null;
      });
    }
  } finally {
    node.destroy();
  }
  return { passed: checks.every((entry) => entry.ok), checks };
}
