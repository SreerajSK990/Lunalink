import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import {
  builtInSocketFactory,
  type SocketFactory,
  type SocketHandlers,
} from "../../../src/transport/ws/SocketFactory.js";
import { createWsSocketFactory } from "../../../src/transport/ws/wsSocketFactory.js";

interface Captured {
  headers: Record<string, string | string[] | undefined>;
}

let server: WebSocketServer;
let url: string;
const captured: Captured = { headers: {} };

beforeEach(async () => {
  server = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/v4/websocket`;
  server.on("connection", (socket, request) => {
    captured.headers = request.headers;
    socket.send(JSON.stringify({ op: "ready", resumed: false, sessionId: "abc" }));
    socket.send(Buffer.from([1, 2, 3]));
    setTimeout(() => {
      socket.close(4000, "bye");
    }, 30);
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

function run(factory: SocketFactory) {
  return new Promise<{ messages: (string | Uint8Array)[]; close: [number, string] }>(
    (resolve, reject) => {
      const messages: (string | Uint8Array)[] = [];
      const handlers: SocketHandlers = {
        onOpen() {
          messages.length = 0;
        },
        onMessage(data) {
          messages.push(data);
        },
        onError(error) {
          reject(error);
        },
        onClose(code, reason) {
          resolve({ messages, close: [code, reason] });
        },
      };
      factory(
        url,
        { Authorization: "pw", "User-Id": "170939974227541168", "Client-Name": "lunalink/0.1.0" },
        handlers,
      );
    },
  );
}

describe.each([
  ["built-in WebSocket", builtInSocketFactory],
  ["ws package", createWsSocketFactory(WebSocket)],
])("%s factory", (_name, factory) => {
  it("sends the custom headers and delivers text and binary frames", async () => {
    const result = await run(factory);
    expect(captured.headers["authorization"]).toBe("pw");
    expect(captured.headers["user-id"]).toBe("170939974227541168");
    expect(captured.headers["client-name"]).toBe("lunalink/0.1.0");
    expect(result.messages[0]).toBe('{"op":"ready","resumed":false,"sessionId":"abc"}');
    expect(result.messages[1]).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.messages[1] as Uint8Array)).toEqual([1, 2, 3]);
    expect(result.close).toEqual([4000, "bye"]);
  });
});
