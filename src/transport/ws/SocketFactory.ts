/**
 * What a socket reports back to Lunalink.
 */
export interface SocketHandlers {
  /** The connection opened. */
  onOpen(): void;
  /** A message arrived. Text frames come as strings, binary frames as bytes. */
  onMessage(data: string | Uint8Array): void;
  /** The connection closed, cleanly or not. Called exactly once. */
  onClose(code: number, reason: string): void;
  /** Something went wrong. `onClose` always follows. */
  onError(error: Error): void;
}

/**
 * The only thing Lunalink does with an open socket: close it. Lavalink's gateway is one-way,
 * and NodeLink closes the connection if a client sends anything, so there is deliberately no
 * `send`.
 */
export interface SocketHandle {
  /**
   * Closes the connection.
   *
   * @param code - Close code. Defaults to 1000.
   * @param reason - Close reason.
   */
  close(code?: number, reason?: string): void;
}

/**
 * Opens a WebSocket with custom headers. Swap it out to use a different WebSocket library.
 *
 * @param url - `ws://` or `wss://` address.
 * @param headers - Headers for the upgrade request.
 * @param handlers - Callbacks for socket events.
 * @returns A handle for closing the socket.
 */
export type SocketFactory = (
  url: string,
  headers: Readonly<Record<string, string>>,
  handlers: SocketHandlers,
) => SocketHandle;

interface StandardMessageEvent {
  data: unknown;
}

interface StandardCloseEvent {
  code: number;
  reason: string;
}

interface StandardWebSocket {
  binaryType: string;
  onopen: (() => void) | null;
  onmessage: ((event: StandardMessageEvent) => void) | null;
  onclose: ((event: StandardCloseEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(code?: number, reason?: string): void;
}

type StandardWebSocketConstructor = new (
  url: string,
  init: { headers: Record<string, string> },
) => StandardWebSocket;

/**
 * Finds the runtime's built-in `WebSocket`.
 *
 * @returns The constructor, or `undefined` when the runtime has none.
 */
function findBuiltInWebSocket(): StandardWebSocketConstructor | undefined {
  const candidate = (globalThis as { WebSocket?: unknown }).WebSocket;
  return typeof candidate === "function" ? (candidate as StandardWebSocketConstructor) : undefined;
}

/**
 * Turns whatever a socket delivered into a string or bytes.
 *
 * @param data - Raw message data.
 * @returns Text or bytes.
 */
export function normalizeMessageData(data: unknown): string | Uint8Array {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data) && data.every((part) => part instanceof Uint8Array)) {
    const parts = data;
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      joined.set(part, offset);
      offset += part.byteLength;
    }
    return joined;
  }
  return String(data);
}

/**
 * The default factory. It uses the runtime's built-in `WebSocket`, which accepts custom headers
 * on Node.js 22+, Bun and Deno 2.5+. On anything older, pass `createWsSocketFactory(WebSocket)`
 * from `lunalink/transport/ws` instead.
 *
 * @param url - Address to connect to.
 * @param headers - Upgrade request headers.
 * @param handlers - Callbacks.
 * @returns A handle for closing the socket.
 * @throws {Error} When the runtime has no built-in `WebSocket`.
 */
export const builtInSocketFactory: SocketFactory = (url, headers, handlers) => {
  const WebSocketClass = findBuiltInWebSocket();
  if (!WebSocketClass) {
    throw new Error(
      "This runtime has no built-in WebSocket. Install `ws` and pass createWsSocketFactory(WebSocket) as socketFactory.",
    );
  }
  const socket = new WebSocketClass(url, { headers: { ...headers } });
  socket.binaryType = "arraybuffer";
  let closed = false;
  socket.onopen = () => {
    handlers.onOpen();
  };
  socket.onmessage = (event) => {
    handlers.onMessage(normalizeMessageData(event.data));
  };
  socket.onerror = (event) => {
    const message = (event as { message?: unknown }).message;
    handlers.onError(
      new Error(typeof message === "string" && message ? message : "WebSocket error"),
    );
  };
  socket.onclose = (event) => {
    if (closed) return;
    closed = true;
    handlers.onClose(event.code, event.reason);
  };
  return {
    close(code = 1000, reason = "") {
      socket.close(code, reason);
    },
  };
};
