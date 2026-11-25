/**
 * Frame types sent on NodeLink's voice receive socket.
 *
 * Source: `src/voice/voiceFrames.ts` (`VOICE_FRAME_OPS`).
 */
export const VoiceFrameOp = {
  /** A user started speaking. */
  Start: 1,
  /** A user stopped speaking. */
  Stop: 2,
  /** Audio data. */
  Data: 3,
} as const;

/**
 * One of the values of {@link VoiceFrameOp}.
 */
export type VoiceFrameOp = (typeof VoiceFrameOp)[keyof typeof VoiceFrameOp];

/**
 * Audio formats NodeLink can send. The server picks one in its config.
 *
 * Source: `src/voice/voiceFrames.ts` (`VOICE_FORMATS`).
 */
export const VoiceFrameFormat = {
  /** Raw Opus packets. */
  Opus: 0,
  /** Ogg container. */
  Ogg: 1,
  /** 16-bit little-endian PCM. */
  PcmS16le: 2,
} as const;

/**
 * One of the values of {@link VoiceFrameFormat}.
 */
export type VoiceFrameFormat = (typeof VoiceFrameFormat)[keyof typeof VoiceFrameFormat];

/**
 * A decoded voice receive frame.
 *
 * Binary layout, from `buildVoiceFrame`: `op` (u8), `format` (u8), guild id length (u8), guild id
 * (utf8), user id length (u8), user id (utf8), `ssrc` (u32 BE), `timestamp` (u32 BE), payload.
 */
export interface VoiceFrame {
  /** Frame type. */
  op: VoiceFrameOp;
  /** Audio format of `payload`. */
  format: VoiceFrameFormat;
  /** Guild id. */
  guildId: string;
  /** Speaking user's id. */
  userId: string;
  /** RTP source id of the speaker. */
  ssrc: number;
  /** RTP timestamp. */
  timestamp: number;
  /** Audio bytes. Empty for start and stop frames. */
  payload: Uint8Array;
}
