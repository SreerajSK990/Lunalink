import type { ApiFilters } from "./filters.js";
import type { JsonObject } from "./json.js";
import type { ApiTrack } from "./track.js";

/**
 * Live player state, sent in `playerUpdate` messages and in player responses.
 */
export interface ApiPlayerState {
  /** Server time in Unix milliseconds when this state was taken. */
  time: number;
  /** Track position in milliseconds at `time`. */
  position: number;
  /** Whether the server is connected to the Discord voice gateway. */
  connected: boolean;
  /** Round trip to the Discord voice server in milliseconds, or `-1` when not connected. */
  ping: number;
}

/**
 * The Discord voice credentials the server needs to join a voice channel.
 *
 * `sessionId` and `channelId` come from `VOICE_STATE_UPDATE`; `token` and `endpoint` come from
 * `VOICE_SERVER_UPDATE`.
 */
export interface ApiVoiceState {
  /** Voice token from `VOICE_SERVER_UPDATE`. */
  token: string;
  /** Voice server host from `VOICE_SERVER_UPDATE`. */
  endpoint: string;
  /** Discord voice session id from `VOICE_STATE_UPDATE`. */
  sessionId: string;
  /** Voice channel id. Lavalink 4.2+ needs it for DAVE; older v4 servers ignore it. */
  channelId?: string | null;
}

/**
 * A player as returned by the player endpoints.
 */
export interface ApiPlayer {
  /** Guild the player belongs to. */
  guildId: string;
  /** The track that is playing, or `null`. */
  track: ApiTrack | null;
  /** Player volume in percent, 0 to 1000. */
  volume: number;
  /** Whether playback is paused. */
  paused: boolean;
  /** Live state. */
  state: ApiPlayerState;
  /** Voice credentials the server is using. */
  voice: ApiVoiceState;
  /** Active filters. */
  filters: ApiFilters;
}

/**
 * The track part of an update player request. Set either `encoded` or `identifier`, not both.
 */
export interface ApiUpdatePlayerTrack {
  /** Encoded track to play. `null` stops the current track. */
  encoded?: string | null;
  /** Identifier the server resolves to a single track. Playlists and searches return HTTP 400. */
  identifier?: string;
  /** Data the server stores on the track and echoes back in `ApiTrack.userData`. */
  userData?: JsonObject;
}

/**
 * Body of `PATCH /v4/sessions/{sessionId}/players/{guildId}`. Every field is optional; only the
 * fields you send are changed.
 */
export interface ApiUpdatePlayer {
  /** Track to load and play. */
  track?: ApiUpdatePlayerTrack;
  /** Position to seek to, in milliseconds. */
  position?: number;
  /** Position to stop at, in milliseconds (above 0). `null` clears a previous end time. */
  endTime?: number | null;
  /** Volume in percent, 0 to 1000. */
  volume?: number;
  /** Pause or resume playback. */
  paused?: boolean;
  /** Replaces all active filters. */
  filters?: ApiFilters;
  /** Voice credentials for joining or moving a voice channel. */
  voice?: ApiVoiceState;
}

/**
 * Query parameters of the update player endpoint.
 */
export interface ApiUpdatePlayerQuery {
  /** When `true`, a new track is ignored if one is already playing. Defaults to `false`. */
  noReplace?: boolean;
}
