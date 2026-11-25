import { ValidationError } from "../errors/ValidationError.js";
import type { AutoLeaveOptions } from "../lifecycle/AutoLeave.js";
import type { AutoplayOptions } from "../lifecycle/Autoplay.js";
import type { FailoverOptions } from "../lifecycle/Failover.js";
import type { PersistenceOptions } from "../lifecycle/Persistence.js";
import type { ResumeOptions } from "../lifecycle/Resume.js";
import type { NodeOptions } from "../node/NodeOptions.js";
import type { NodeSelectionStrategy, NodeSelector } from "../node/selection/strategies.js";
import type { PlayerClass } from "../player/PlayerManager.js";
import type { PlayerDefaults } from "../player/PlayerRuntime.js";
import type { LunalinkPlugin } from "../plugins/Plugin.js";
import type { PluginHostOptions } from "../plugins/PluginHost.js";
import type { QueueProvider } from "../queue/types.js";
import type { LinkRules } from "../search/linkRules.js";
import type { SearchPlatformName } from "../search/platforms.js";
import type { PlayerStore } from "../stores/PlayerStore.js";
import type { TrackFactory } from "../track/toSearchResult.js";
import type { FetchLike } from "../transport/http/HttpClient.js";
import type { SocketFactory } from "../transport/ws/SocketFactory.js";
import type { GatewayAdapter } from "./GatewayAdapter.js";

/**
 * Classes and factories you can swap for your own.
 */
export interface Structures {
  /** Player subclass. */
  player?: PlayerClass;
  /** Creates each player's queue. */
  queue?: QueueProvider;
  /** Builds tracks from node results. */
  trackFactory?: TrackFactory;
}

/**
 * Auto-resume and persistence settings.
 */
export interface LunalinkResumeOptions extends ResumeOptions, PersistenceOptions {}

/**
 * Everything you can pass to `new Lunalink()`. Only `adapter` and `nodes` are required.
 */
export interface LunalinkOptions {
  /** Connects Lunalink to your Discord library. */
  adapter: GatewayAdapter;
  /** Lavalink and NodeLink servers. */
  nodes: NodeOptions[];
  /** How new players pick a node. Defaults to `leastLoad`. */
  nodeSelection?: NodeSelectionStrategy | NodeSelector;
  /** Platform for text searches without a `source`. Defaults to `youtube`. */
  defaultSearchSource?: SearchPlatformName;
  /** Which links `search()` accepts. */
  linkRules?: LinkRules;
  /** Defaults for new players. */
  player?: Partial<PlayerDefaults>;
  /** Leave idle players. Off unless you set a timer. */
  autoLeave?: AutoLeaveOptions;
  /** Autoplay strategies and batch size. Turn autoplay on per player or with `player.autoplay`. */
  autoplay?: AutoplayOptions;
  /** Move players off dead nodes. On by default. */
  failover?: FailoverOptions;
  /** Resume sessions and rebuild players after restarts. On by default. */
  resume?: LunalinkResumeOptions;
  /** Where state is saved. Defaults to memory; use `JsonFileStore` to survive restarts. */
  store?: PlayerStore;
  /** Plugins to install. */
  plugins?: LunalinkPlugin[];
  /** Plugin timeouts. */
  pluginOptions?: PluginHostOptions;
  /** Classes and factories to swap. */
  structures?: Structures;
  /** WebSocket implementation. Defaults to the built-in `WebSocket`. */
  socketFactory?: SocketFactory;
  /** `fetch` implementation, for proxies or tests. */
  fetch?: FetchLike;
  /** `Client-Name` header. Defaults to `lunalink/<version>`. */
  clientName?: string;
}

/**
 * Player defaults Lunalink uses when you don't set them.
 */
export const defaultPlayerDefaults: Readonly<PlayerDefaults> = Object.freeze({
  volume: 100,
  autoplay: false,
  skipOnStuck: true,
  maxConsecutiveErrors: 3,
  gapless: true,
  voiceTimeoutMs: 15_000,
});

/**
 * Checks the options and fills in player defaults.
 *
 * @param options - Options as passed.
 * @returns The player defaults to use.
 * @throws {ValidationError} When a required option is missing.
 */
export function checkOptions(options: LunalinkOptions): PlayerDefaults {
  if (
    typeof options.adapter.clientId !== "function" ||
    typeof options.adapter.listen !== "function"
  ) {
    throw new ValidationError("adapter", "must be a GatewayAdapter (clientId, send, listen)", true);
  }
  if (!Array.isArray(options.nodes) || options.nodes.length === 0) {
    throw new ValidationError("nodes", "needs at least one node", true);
  }
  const defaults = { ...defaultPlayerDefaults, ...options.player };
  if (defaults.volume < 0 || defaults.volume > 1000) {
    throw new ValidationError("player.volume", "must be between 0 and 1000", true);
  }
  return defaults;
}
