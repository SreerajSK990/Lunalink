import { normalizeMessageData, type SocketFactory } from "./SocketFactory.js";

/**
 * The parts of the `ws` package's `WebSocket` class that Lunalink uses.
 */
export interface WsLikeSocket {
  /**
   * Adds an event listener.
   *
   * @param event - Event name.
   * @param listener - Callback.
   */
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  /**
   * Closes the connection.
   *
   * @param code - Close code.
   * @param reason - Close reason.
   */
  close(code?: number, reason?: string): void;
}

/**
 * The `ws` package's `WebSocket` constructor.
 */
export type WsLikeConstructor = new (
  url: string,
  options: { headers: Record<string, string> },
) => WsLikeSocket;

/**
 * Builds a socket factory on top of the `ws` package. Lunalink doesn't depend on `ws`; you
 * install it and hand the class in. Only needed on runtimes whose built-in `WebSocket` can't
 * send custom headers, such as Deno 2.4 and older.
 *
 * @param WebSocketClass - The `WebSocket` export of `ws`.
 * @returns A factory for the `socketFactory` option.
 * @example
 * ```ts
 * import WebSocket from "ws";
 * import { createWsSocketFactory } from "lunalink/transport/ws";
 *
 * const lunalink = new Lunalink({ socketFactory: createWsSocketFactory(WebSocket), ... });
 * ```
 */
export function createWsSocketFactory(WebSocketClass: WsLikeConstructor): SocketFactory {
  return (url, headers, handlers) => {
    const socket = new WebSocketClass(url, { headers: { ...headers } });
    let closed = false;
    socket.on("open", () => {
      handlers.onOpen();
    });
    socket.on("message", (data: unknown, isBinary: unknown) => {
      const normalized = normalizeMessageData(data);
      handlers.onMessage(
        isBinary === false && normalized instanceof Uint8Array
          ? new TextDecoder().decode(normalized)
          : normalized,
      );
    });
    socket.on("error", (error: unknown) => {
      handlers.onError(error instanceof Error ? error : new Error(String(error)));
    });
    socket.on("close", (code: unknown, reason: unknown) => {
      if (closed) return;
      closed = true;
      const text =
        reason instanceof Uint8Array
          ? new TextDecoder().decode(reason)
          : typeof reason === "string"
            ? reason
            : "";
      handlers.onClose(typeof code === "number" ? code : 1006, text);
    });
    return {
      close(code = 1000, reason = "") {
        socket.close(code, reason);
      },
    };
  };
}
