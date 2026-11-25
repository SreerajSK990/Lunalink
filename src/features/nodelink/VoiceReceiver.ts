import { TypedEmitter } from "../../events/TypedEmitter.js";
import type { Node } from "../../node/Node.js";
import { VoiceFrameOp, type VoiceFrame } from "../../protocol/index.js";
import { Routes } from "../../transport/http/routes.js";
import type { SocketHandle } from "../../transport/ws/SocketFactory.js";
import { parseJson } from "../../utils/json.js";
import { decodeVoiceFrame } from "./decodeVoiceFrame.js";

/**
 * Events from a {@link VoiceReceiver}.
 */
export interface VoiceReceiverEvents {
  /** The socket opened. */
  open: [];
  /** A user started speaking. */
  speakingStart: [frame: VoiceFrame];
  /** A user stopped speaking. */
  speakingStop: [frame: VoiceFrame];
  /** Audio arrived. The format depends on NodeLink's `voiceReceive.format` setting. */
  audio: [frame: VoiceFrame];
  /** A text message arrived on the socket. */
  message: [payload: unknown];
  /** The socket closed. 404 on connect means voice receive is off on the server. */
  close: [code: number, reason: string];
  /** Something went wrong. */
  error: [error: Error];
}

/**
 * Receives what people say in the player's voice channel, through NodeLink's
 * `/v4/websocket/voice/{guildId}` socket. Voice receive must be switched on in NodeLink's
 * config (`playback.voiceReceive.enabled`).
 *
 * @example
 * ```ts
 * const receiver = player.nodelink.receiveVoice();
 * receiver.events.on("audio", (frame) => recorder.write(frame.userId, frame.payload));
 * receiver.close();
 * ```
 */
export class VoiceReceiver {
  /** Receiver events. */
  readonly events: TypedEmitter<VoiceReceiverEvents> = new TypedEmitter<VoiceReceiverEvents>();
  readonly #socket: SocketHandle;

  /**
   * Opens the socket.
   *
   * @param node - A NodeLink node.
   * @param guildId - Guild to listen to.
   */
  constructor(node: Node, guildId: string) {
    node.capabilities.require("nodelink:voiceReceive", "Voice receive is a NodeLink feature.");
    this.#socket = node.openSocket(Routes.nodeLinkVoiceSocket(guildId), {
      onOpen: () => this.events.emit("open"),
      onMessage: (data) => {
        this.#handle(data);
      },
      onError: (error) => this.events.emit("error", error),
      onClose: (code, reason) => {
        this.events.emit("close", code, reason);
        this.events.removeAllListeners();
      },
    });
  }

  /**
   * Closes the socket.
   */
  close(): void {
    this.#socket.close(1000, "Voice receive closed");
  }

  #handle(data: string | Uint8Array): void {
    if (typeof data === "string") {
      const parsed = parseJson(data);
      this.events.emit("message", parsed.ok ? parsed.value : data);
      return;
    }
    const frame = decodeVoiceFrame(data);
    if (!frame) return;
    if (frame.op === VoiceFrameOp.Start) this.events.emit("speakingStart", frame);
    else if (frame.op === VoiceFrameOp.Stop) this.events.emit("speakingStop", frame);
    else this.events.emit("audio", frame);
  }
}
