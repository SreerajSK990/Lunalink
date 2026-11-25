import { TypedEmitter } from "../../events/TypedEmitter.js";
import type { Node } from "../../node/Node.js";
import { Routes } from "../../transport/http/routes.js";
import type { SocketHandle } from "../../transport/ws/SocketFactory.js";
import { parseJson } from "../../utils/json.js";

/**
 * Events from a {@link LiveChat}.
 */
export interface LiveChatEvents {
  /** The socket opened. */
  open: [];
  /** A chat update. NodeLink passes YouTube's data through, so its shape isn't fixed. */
  message: [payload: unknown];
  /** The socket closed. Code 1008 means the server can't read this stream's chat. */
  close: [code: number, reason: string];
  /** Something went wrong. */
  error: [error: Error];
}

/**
 * Reads a YouTube live stream's chat through NodeLink's `/v4/websocket/youtube/live/{id}`
 * socket. Messages are delivered as NodeLink sends them.
 */
export class LiveChat {
  /** Chat events. */
  readonly events: TypedEmitter<LiveChatEvents> = new TypedEmitter<LiveChatEvents>();
  readonly #socket: SocketHandle;

  /**
   * Opens the socket.
   *
   * @param node - A NodeLink node.
   * @param videoId - YouTube video id or link of the live stream.
   */
  constructor(node: Node, videoId: string) {
    node.capabilities.require("nodelink:liveChat", "Live chat is a NodeLink feature.");
    this.#socket = node.openSocket(Routes.nodeLinkLiveChatSocket(videoId), {
      onOpen: () => this.events.emit("open"),
      onMessage: (data) => {
        const text = typeof data === "string" ? data : new TextDecoder().decode(data);
        const parsed = parseJson(text);
        this.events.emit("message", parsed.ok ? parsed.value : text);
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
    this.#socket.close(1000, "Live chat closed");
  }
}
