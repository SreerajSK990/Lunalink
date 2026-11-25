import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * The server side of one WebSocket connection, enough for a mock node: text messages, ping,
 * close and abrupt termination. Built on `node:http` upgrades so the testing kit needs no
 * dependency.
 */
export class ServerSocket {
  /** Called with each text message from the client. */
  onMessage: ((text: string) => void) | null = null;
  /** Called once when the connection ends. */
  onClose: ((code: number) => void) | null = null;
  readonly #socket: Duplex;
  #buffer: Buffer = Buffer.alloc(0);
  #closed = false;

  /**
   * Finishes the HTTP upgrade and wraps the socket.
   *
   * @param request - The upgrade request.
   * @param socket - The raw socket.
   * @returns The connection, or `null` when the request isn't a valid WebSocket upgrade.
   */
  static accept(request: IncomingMessage, socket: Duplex): ServerSocket | null {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return null;
    }
    const accept = createHash("sha1")
      .update(key + GUID)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    return new ServerSocket(socket);
  }

  private constructor(socket: Duplex) {
    this.#socket = socket;
    socket.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#drain();
    });
    socket.on("close", () => {
      this.#finish(1006);
    });
    socket.on("error", () => {
      this.#finish(1006);
    });
  }

  /**
   * Sends a text message.
   *
   * @param text - The message.
   */
  send(text: string): void {
    if (!this.#closed) this.#socket.write(frame(0x1, Buffer.from(text, "utf8")));
  }

  /**
   * Closes the connection cleanly.
   *
   * @param code - Close code.
   */
  close(code = 1000): void {
    if (this.#closed) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code);
    this.#socket.write(frame(0x8, body));
    this.#socket.end();
    this.#finish(code);
  }

  /**
   * Drops the connection without a close frame, like a crash.
   */
  terminate(): void {
    this.#socket.destroy();
    this.#finish(1006);
  }

  #drain(): void {
    for (;;) {
      const parsed = parseFrame(this.#buffer);
      if (!parsed) return;
      this.#buffer = this.#buffer.subarray(parsed.length);
      if (parsed.opcode === 0x1) this.onMessage?.(parsed.payload.toString("utf8"));
      else if (parsed.opcode === 0x9) this.#socket.write(frame(0xa, parsed.payload));
      else if (parsed.opcode === 0x8) {
        const code = parsed.payload.length >= 2 ? parsed.payload.readUInt16BE(0) : 1005;
        this.close(code === 1005 ? 1000 : code);
      }
    }
  }

  #finish(code: number): void {
    if (this.#closed) return;
    this.#closed = true;
    this.onClose?.(code);
  }
}

function frame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  const header =
    length < 126 ? Buffer.alloc(2) : length < 65_536 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (length < 126) header[1] = length;
  else if (length < 65_536) {
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function parseFrame(buffer: Buffer): { opcode: number; payload: Buffer; length: number } | null {
  if (buffer.length < 2) return null;
  const first = buffer[0] ?? 0;
  const second = buffer[1] ?? 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (second & 0x80) !== 0;
  const maskOffset = offset;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = (payload[i] ?? 0) ^ (buffer[maskOffset + (i % 4)] ?? 0);
    }
  }
  return { opcode: first & 0x0f, payload, length: offset + length };
}
