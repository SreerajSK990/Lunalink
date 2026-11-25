import type { VoiceFrame, VoiceFrameFormat, VoiceFrameOp } from "../../protocol/index.js";

const decoder = new TextDecoder();

/**
 * Decodes one binary frame from NodeLink's voice receive socket.
 *
 * Layout, from `buildVoiceFrame` in NodeLink's `src/voice/voiceFrames.ts`: op (u8), format
 * (u8), guild id length (u8), guild id, user id length (u8), user id, ssrc (u32 big-endian),
 * timestamp (u32 big-endian), then the audio payload.
 *
 * @param bytes - The frame.
 * @returns The decoded frame, or `null` when it's too short or malformed.
 */
export function decodeVoiceFrame(bytes: Uint8Array): VoiceFrame | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const need = (count: number): boolean => offset + count <= bytes.byteLength;
  if (!need(3)) return null;
  const op = view.getUint8(offset++);
  const format = view.getUint8(offset++);
  const guildLength = view.getUint8(offset++);
  if (!need(guildLength + 1)) return null;
  const guildId = decoder.decode(bytes.subarray(offset, offset + guildLength));
  offset += guildLength;
  const userLength = view.getUint8(offset++);
  if (!need(userLength + 8)) return null;
  const userId = decoder.decode(bytes.subarray(offset, offset + userLength));
  offset += userLength;
  const ssrc = view.getUint32(offset);
  offset += 4;
  const timestamp = view.getUint32(offset);
  offset += 4;
  if (op < 1 || op > 3) return null;
  return {
    op: op as VoiceFrameOp,
    format: format as VoiceFrameFormat,
    guildId,
    userId,
    ssrc,
    timestamp,
    payload: bytes.slice(offset),
  };
}
