import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import {
  closeMarketStreamService,
  getMarketStreamService,
} from "./market-stream.service.js";

export function attachWebSocketServer(httpServer: Server): WebSocketServer {
  const marketStream = getMarketStreamService();
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (client) => {
    marketStream.addClient(client);

    client.on("message", (data) => {
      marketStream.handleClientMessage(client, data.toString());
    });

    client.on("close", () => {
      marketStream.removeClient(client);
    });
  });

  console.log("[websocket] listening on /ws");
  return wss;
}

export function shutdownWebSocketServer(wss: WebSocketServer): Promise<void> {
  closeMarketStreamService();

  return new Promise((resolve, reject) => {
    wss.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
