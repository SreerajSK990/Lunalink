const segment = encodeURIComponent;

/**
 * Every REST path Lunalink calls, in one place. Paths for Lavalink plugins come from each
 * plugin's `@*Mapping` annotations; NodeLink paths come from its `src/api` file names.
 */
export const Routes = {
  version: (): string => "/version",
  info: (): string => "/v4/info",
  stats: (): string => "/v4/stats",
  loadTracks: (): string => "/v4/loadtracks",
  decodeTrack: (): string => "/v4/decodetrack",
  decodeTracks: (): string => "/v4/decodetracks",
  session: (sessionId: string): string => `/v4/sessions/${segment(sessionId)}`,
  players: (sessionId: string): string => `/v4/sessions/${segment(sessionId)}/players`,
  player: (sessionId: string, guildId: string): string =>
    `/v4/sessions/${segment(sessionId)}/players/${segment(guildId)}`,
  routePlannerStatus: (): string => "/v4/routeplanner/status",
  routePlannerFreeAddress: (): string => "/v4/routeplanner/free/address",
  routePlannerFreeAll: (): string => "/v4/routeplanner/free/all",

  lavaSearch: (): string => "/v4/loadsearch",
  lavaLyrics: (): string => "/v4/lyrics",
  lavaLyricsCurrent: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/track/lyrics`,
  lyricsSubscribe: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/lyrics/subscribe`,
  lyricsKtByVideo: (videoId: string): string => `/v4/lyrics/${segment(videoId)}`,
  lyricsKtSearch: (query: string): string => `/v4/lyrics/search/${segment(query)}`,
  lyricsKtCurrent: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/lyrics`,
  sponsorBlockCategories: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/sponsorblock/categories`,
  lavaSrcConfig: (): string => "/v4/lavasrc/config",
  youtubeSourceConfig: (): string => "/youtube",
  youtubeSourceOAuth: (refreshToken: string): string => `/youtube/oauth/${segment(refreshToken)}`,

  nodeLinkLyrics: (): string => "/v4/loadlyrics",
  nodeLinkChapters: (): string => "/v4/loadchapters",
  nodeLinkMeaning: (): string => "/v4/meaning",
  nodeLinkEncodeTrack: (): string => "/v4/encodetrack",
  nodeLinkEncodeTracks: (): string => "/v4/encodedtracks",
  nodeLinkLoadStream: (): string => "/v4/loadstream",
  nodeLinkTrackStream: (): string => "/v4/trackstream",
  nodeLinkConnection: (): string => "/v4/connection",
  nodeLinkSourcesHealth: (): string => "/v4/sources/health",
  nodeLinkWorkers: (): string => "/v4/workers",
  nodeLinkYoutubeConfig: (): string => "/v4/youtube/config",
  nodeLinkYoutubeOAuth: (): string => "/v4/youtube/oauth",
  nodeLinkSponsorBlock: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/sponsorblock`,
  nodeLinkMix: (sessionId: string, guildId: string): string =>
    `${Routes.player(sessionId, guildId)}/mix`,
  nodeLinkMixLayer: (sessionId: string, guildId: string, mixId: string): string =>
    `${Routes.player(sessionId, guildId)}/mix/${segment(mixId)}`,
  nodeLinkGroups: (sessionId: string): string => `/v4/sessions/${segment(sessionId)}/groups`,
  nodeLinkGroup: (sessionId: string, groupId: string): string =>
    `/v4/sessions/${segment(sessionId)}/groups/${segment(groupId)}`,

  websocket: (): string => "/v4/websocket",
  nodeLinkVoiceSocket: (guildId: string): string => `/v4/websocket/voice/${segment(guildId)}`,
  nodeLinkLiveChatSocket: (videoId: string): string =>
    `/v4/websocket/youtube/live/${segment(videoId)}`,
} as const;
