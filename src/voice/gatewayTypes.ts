/**
 * The `d` of a Discord `VOICE_STATE_UPDATE`, reduced to what Lunalink reads.
 */
export interface VoiceStateData {
  /** Guild id. Missing inside `GUILD_CREATE.voice_states`. */
  guild_id?: string;
  /** Channel id, or `null` when the user left voice. */
  channel_id: string | null;
  /** User id. */
  user_id: string;
  /** Voice session id. */
  session_id: string;
  /** Whether the user deafened themselves. */
  self_deaf?: boolean;
  /** Whether the user muted themselves. */
  self_mute?: boolean;
  /** Whether a moderator deafened the user. */
  deaf?: boolean;
  /** Whether a moderator muted the user. */
  mute?: boolean;
  /** Whether the user is suppressed in a stage channel. */
  suppress?: boolean;
  /** Guild member, when Discord includes it. */
  member?: { user?: { id: string; bot?: boolean } };
}

/**
 * The `d` of a Discord `VOICE_SERVER_UPDATE`.
 */
export interface VoiceServerData {
  /** Voice token. */
  token: string;
  /** Guild id. */
  guild_id: string;
  /** Voice server host, or `null` while Discord picks a new server. */
  endpoint: string | null;
}

/**
 * The opcode 4 payload sent to Discord to join, move or leave a voice channel.
 */
export interface VoiceStateUpdatePayload {
  /** Always 4. */
  op: 4;
  /** Payload data. */
  d: {
    /** Guild id. */
    guild_id: string;
    /** Channel to join, or `null` to leave. */
    channel_id: string | null;
    /** Join muted. */
    self_mute: boolean;
    /** Join deafened. */
    self_deaf: boolean;
  };
}

/**
 * Sends a payload over the bot's gateway connection for a guild's shard.
 *
 * @param guildId - Guild the payload is about. Adapters use it to pick the shard.
 * @param payload - Payload to send.
 */
export type GatewaySender = (
  guildId: string,
  payload: VoiceStateUpdatePayload,
) => void | Promise<void>;
