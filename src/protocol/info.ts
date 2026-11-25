/**
 * Lavalink's parsed semantic version.
 */
export interface ApiLavalinkVersion {
  /** Full version string, for example `4.2.2`. */
  semver: string;
  /** Major version. */
  major: number;
  /** Minor version. */
  minor: number;
  /** Patch version. */
  patch: number;
  /** Pre-release part, for example `rc.1`, or `null`. */
  preRelease: string | null;
  /** Build metadata, or `null`. The docs list it, but not every server sends it. */
  build?: string | null;
}

/**
 * Git details of the server build.
 */
export interface ApiGitInfo {
  /** Branch the server was built from. */
  branch: string;
  /** Commit hash. */
  commit: string;
  /** Commit time in Unix milliseconds. */
  commitTime: number;
}

/**
 * A server plugin listed in `GET /v4/info`.
 */
export interface ApiPluginInfo {
  /** Plugin name, for example `lavasrc-plugin`. */
  name: string;
  /** Plugin version. */
  version: string;
}

/**
 * Response of `GET /v4/info` from a Lavalink server.
 */
export interface ApiLavalinkInfo {
  /** Server version. */
  version: ApiLavalinkVersion;
  /** Build time in Unix milliseconds. */
  buildTime: number;
  /** Git details. */
  git: ApiGitInfo;
  /** JVM version. */
  jvm: string;
  /** Lavaplayer version. */
  lavaplayer: string;
  /** Enabled source managers, for example `youtube` or `soundcloud`. */
  sourceManagers: string[];
  /** Enabled filters, including plugin filters. */
  filters: string[];
  /** Loaded plugins. */
  plugins: ApiPluginInfo[];
}
