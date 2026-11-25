/**
 * One search platform: the prefix the server understands and the source managers that serve it.
 * A search is allowed when the node reports at least one of `sources` in `/v4/info`.
 */
export interface SearchPlatform {
  /** Prefix without the colon, for example `ytsearch`. */
  prefix: string;
  /** Source manager names that handle the prefix. */
  sources: readonly string[];
}

/**
 * A platform name accepted by `search(query, { source })`.
 */
export type SearchPlatformName =
  | "youtube"
  | "youtubeMusic"
  | "soundcloud"
  | "bandcamp"
  | "spotify"
  | "appleMusic"
  | "deezer"
  | "deezerIsrc"
  | "tidal"
  | "qobuz"
  | "qobuzIsrc"
  | "yandexMusic"
  | "vkMusic"
  | "jioSaavn"
  | "amazonMusic"
  | "pandora"
  | "audius"
  | "gaana"
  | "mixcloud"
  | "audiomack"
  | "anghami"
  | "netease"
  | "qqMusic"
  | "shazam"
  | "bilibili"
  | "niconico"
  | "lastfm"
  | "iheartradio"
  | "googleDrive";

/**
 * Search platforms, keyed by the name you pass as `source`.
 *
 * Every prefix and source name was read from the server that implements it: lavaplayer
 * (`ytsearch`, `ytmsearch`, `scsearch`, `bcsearch`), youtube-source, LavaSrc
 * (`*SourceManager.java`), and NodeLink (`searchTerms` in `src/sources/*.ts`).
 */
export const searchPlatforms: Readonly<Record<SearchPlatformName, SearchPlatform>> = {
  youtube: { prefix: "ytsearch", sources: ["youtube"] },
  youtubeMusic: { prefix: "ytmsearch", sources: ["youtube"] },
  soundcloud: { prefix: "scsearch", sources: ["soundcloud"] },
  bandcamp: { prefix: "bcsearch", sources: ["bandcamp"] },
  spotify: { prefix: "spsearch", sources: ["spotify"] },
  appleMusic: { prefix: "amsearch", sources: ["applemusic"] },
  deezer: { prefix: "dzsearch", sources: ["deezer"] },
  deezerIsrc: { prefix: "dzisrc", sources: ["deezer"] },
  tidal: { prefix: "tdsearch", sources: ["tidal"] },
  qobuz: { prefix: "qbsearch", sources: ["qobuz"] },
  qobuzIsrc: { prefix: "qbisrc", sources: ["qobuz"] },
  yandexMusic: { prefix: "ymsearch", sources: ["yandexmusic", "yandex-music"] },
  vkMusic: { prefix: "vksearch", sources: ["vkmusic"] },
  jioSaavn: { prefix: "jssearch", sources: ["jiosaavn"] },
  amazonMusic: { prefix: "azsearch", sources: ["amazonmusic"] },
  pandora: { prefix: "pdsearch", sources: ["pandora"] },
  audius: { prefix: "ausearch", sources: ["audius"] },
  gaana: { prefix: "gnsearch", sources: ["gaana"] },
  mixcloud: { prefix: "mcsearch", sources: ["mixcloud"] },
  audiomack: { prefix: "admsearch", sources: ["audiomack"] },
  anghami: { prefix: "agsearch", sources: ["anghami"] },
  netease: { prefix: "ntsearch", sources: ["netease"] },
  qqMusic: { prefix: "qqsearch", sources: ["qqmusic"] },
  shazam: { prefix: "shsearch", sources: ["shazam"] },
  bilibili: { prefix: "bilisearch", sources: ["bilibili"] },
  niconico: { prefix: "ncsearch", sources: ["nicovideo", "niconico"] },
  lastfm: { prefix: "lfsearch", sources: ["lastfm"] },
  iheartradio: { prefix: "ihsearch", sources: ["iheartradio"] },
  googleDrive: { prefix: "gdsearch", sources: ["googledrive"] },
};

/**
 * Recommendation prefixes, keyed by the `sourceName` of the track they start from. Used by
 * autoplay. Lavalink handles them through LavaSrc, NodeLink natively (`recommendationTerm`).
 */
export const recommendationPrefixes: Readonly<Record<string, string>> = {
  spotify: "sprec",
  deezer: "dzrec",
  tidal: "tdrec",
  qobuz: "qbrec",
  yandexmusic: "ymrec",
  vkmusic: "vkrec",
  jiosaavn: "jsrec",
};

const PREFIX_PATTERN = /^([a-z]{2,16}):(?!\/\/)/i;

const OTHER_PREFIXES: ReadonlySet<string> = new Set([
  "speak",
  "tts",
  "gtts",
  "ftts",
  "flowery",
  "pipertts",
  "lazytts",
  "lazypytts",
  "eternalbox",
  "ebox",
  "jukebox",
  "spsuggest",
  "spsimilar",
  "amazonmusic",
  "audiomack",
  "bilibili",
  "iheartradio",
  "nicovideo",
  "lastfm",
]);

/**
 * Finds a search prefix the user already typed, such as `scsearch:` in `scsearch:lofi`. Only
 * known prefixes and words ending in `search`, `rec` or `isrc` count, so a title like
 * `Song: The Remix` isn't mistaken for one.
 *
 * @param query - Raw query.
 * @returns The prefix in lower case, or `null`.
 */
export function readTypedPrefix(query: string): string | null {
  const prefix = PREFIX_PATTERN.exec(query)?.[1]?.toLowerCase();
  if (!prefix) return null;
  if (OTHER_PREFIXES.has(prefix) || /(search|rec|isrc)$/.test(prefix)) return prefix;
  return null;
}

/**
 * Checks whether text is an http(s) link.
 *
 * @param query - Text to check.
 * @returns `true` for links.
 */
export function isLink(query: string): boolean {
  return /^https?:\/\//i.test(query.trim());
}
