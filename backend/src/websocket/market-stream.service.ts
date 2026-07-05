import WebSocket from "ws";
import { config } from "../config/index.js";
import { GeminiWsClient } from "../services/exchanges/gemini/gemini.ws.client.js";
import {
  mapGeminiBookTicker,
  mapGeminiTradeStream,
  toGeminiBookTickerStream,
  toGeminiTradeStream,
} from "../services/exchanges/gemini/gemini.ws.mapper.js";
import type { ClientMessage, ServerMessage } from "../types/websocket.js";
import { normalizeSymbol, toGeminiSymbol } from "../utils/symbols.js";
import { AppError } from "../types/api.js";

export class MarketStreamService {
  private readonly geminiWs: GeminiWsClient;
  private readonly clients = new Set<WebSocket>();
  private readonly symbolClients = new Map<string, Set<WebSocket>>();
  private readonly geminiStreams = new Map<string, number>();

  constructor(geminiWs: GeminiWsClient) {
    this.geminiWs = geminiWs;

    this.geminiWs.on("bookTicker", (message) => {
      const update = mapGeminiBookTicker(message);
      this.broadcast(update.symbol, { type: "ticker", data: update });
    });

    this.geminiWs.on("trade", (message) => {
      const update = mapGeminiTradeStream(message);
      this.broadcast(update.symbol, { type: "trade", data: update });
    });

    this.geminiWs.connect();
  }

  addClient(client: WebSocket): void {
    this.clients.add(client);
    this.send(client, { type: "connected" });
  }

  removeClient(client: WebSocket): void {
    this.clients.delete(client);

    for (const symbol of [...this.symbolClients.keys()]) {
      const subscribers = this.symbolClients.get(symbol);
      if (!subscribers?.has(client)) {
        continue;
      }

      subscribers.delete(client);
      if (subscribers.size === 0) {
        this.symbolClients.delete(symbol);
        this.removeGeminiStreams(symbol);
      }
    }
  }

  handleClientMessage(client: WebSocket, raw: string): void {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(client, { type: "error", message: "Invalid JSON message" });
      return;
    }

    try {
      switch (message.type) {
        case "subscribe":
          this.subscribeClient(client, message.symbol);
          break;
        case "unsubscribe":
          this.unsubscribeClient(client, message.symbol);
          break;
        default:
          this.send(client, { type: "error", message: "Unknown message type" });
      }
    } catch (error) {
      const errMessage =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to process message";
      this.send(client, { type: "error", message: errMessage });
    }
  }

  close(): void {
    this.geminiWs.close();
    this.clients.clear();
    this.symbolClients.clear();
    this.geminiStreams.clear();
  }

  private subscribeClient(client: WebSocket, symbolInput: string): void {
    const symbol = this.parseSymbol(symbolInput);
    let subscribers = this.symbolClients.get(symbol);

    if (!subscribers) {
      subscribers = new Set();
      this.symbolClients.set(symbol, subscribers);
    }

    const isNewSymbol = subscribers.size === 0;
    subscribers.add(client);

    if (isNewSymbol) {
      this.addGeminiStreams(symbol);
    }

    this.send(client, { type: "subscribed", symbol });
  }

  private unsubscribeClient(client: WebSocket, symbolInput: string): void {
    const symbol = this.parseSymbol(symbolInput);
    const subscribers = this.symbolClients.get(symbol);

    if (!subscribers?.has(client)) {
      this.send(client, { type: "unsubscribed", symbol });
      return;
    }

    subscribers.delete(client);

    if (subscribers.size === 0) {
      this.symbolClients.delete(symbol);
      this.removeGeminiStreams(symbol);
    }

    this.send(client, { type: "unsubscribed", symbol });
  }

  private addGeminiStreams(symbol: string): void {
    const geminiSymbol = toGeminiSymbol(symbol);
    const streams = [
      toGeminiBookTickerStream(geminiSymbol),
      toGeminiTradeStream(geminiSymbol),
    ];

    for (const stream of streams) {
      this.geminiStreams.set(stream, (this.geminiStreams.get(stream) ?? 0) + 1);
    }

    this.geminiWs.subscribe(streams);
  }

  private removeGeminiStreams(symbol: string): void {
    const geminiSymbol = toGeminiSymbol(symbol);
    const streams = [
      toGeminiBookTickerStream(geminiSymbol),
      toGeminiTradeStream(geminiSymbol),
    ];

    const streamsToRemove = streams.filter((stream) => {
      const count = this.geminiStreams.get(stream) ?? 0;
      if (count <= 1) {
        this.geminiStreams.delete(stream);
        return true;
      }

      this.geminiStreams.set(stream, count - 1);
      return false;
    });

    if (streamsToRemove.length > 0) {
      this.geminiWs.unsubscribe(streamsToRemove);
    }
  }

  private broadcast(symbol: string, message: ServerMessage): void {
    const subscribers = this.symbolClients.get(symbol);
    if (!subscribers) {
      return;
    }

    for (const client of subscribers) {
      this.send(client, message);
    }
  }

  private send(client: WebSocket, message: ServerMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }

    client.send(JSON.stringify(message));
  }

  private parseSymbol(symbolInput: string): string {
    try {
      return normalizeSymbol(symbolInput);
    } catch {
      throw new AppError(`Invalid symbol: ${symbolInput}`, 400, "INVALID_SYMBOL");
    }
  }
}

let marketStreamService: MarketStreamService | undefined;

export function getMarketStreamService(): MarketStreamService {
  if (!marketStreamService) {
    const geminiWs = new GeminiWsClient({ url: config.geminiWsUrl });
    marketStreamService = new MarketStreamService(geminiWs);
  }

  return marketStreamService;
}

export function closeMarketStreamService(): void {
  marketStreamService?.close();
  marketStreamService = undefined;
}
