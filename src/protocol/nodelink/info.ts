import type { ApiGitInfo } from "../info.js";

/**
 * NodeLink's parsed version. Unlike Lavalink, `prerelease` and `build` are arrays.
 *
 * Source: `PerformanC/NodeLink` `src/typings/utils.types.ts` (`SemverInfo`).
 */
export interface ApiNodeLinkVersion {
  /** Full version string. */
  semver: string;
  /** Major version. */
  major: number;
  /** Minor version. */
  minor: number;
  /** Patch version. */
  patch: number;
  /** Pre-release identifiers, for example `["dev", "2026-11-15", "8"]`. */
  prerelease: string[];
  /** Build metadata identifiers. */
  build: string[];
}

/**
 * A plugin loaded into NodeLink.
 */
export interface ApiNodeLinkPluginInfo {
  /** Plugin name. */
  name: string;
  /** Plugin version. */
  version: string;
  /** Plugin author, when the plugin declares one. */
  author: string | null;
  /** Where the plugin was loaded from. */
  path: string | null;
}

/**
 * Response of `GET /v4/info` from a NodeLink server.
 *
 * Source: `PerformanC/NodeLink` `src/api/info.ts`.
 */
export interface ApiNodeLinkInfo {
  /** Server version. */
  version: ApiNodeLinkVersion;
  /** Build time in Unix milliseconds. */
  buildTime: number;
  /** Git details. */
  git: ApiGitInfo;
  /** Node.js version the server runs on. */
  node: string;
  /** Voice library in use. */
  voice: { name: string; version: string };
  /** Always `true`. This is how NodeLink tells clients apart from Lavalink. */
  isNodelink: true;
  /** Enabled source managers. */
  sourceManagers: string[];
  /** Enabled filters. */
  filters: string[];
  /** Loaded plugins. */
  plugins: ApiNodeLinkPluginInfo[];
  /** Whether source health tracking is on. */
  sourceHealth?: { enabled: boolean };
}
