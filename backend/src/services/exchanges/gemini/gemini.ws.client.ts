import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { logger } from "../../../utils/logger.js";
import {
  isGeminiBookTickerMessage,
  isGeminiTradeStreamMessage,
  isGeminiWsResponse,
  type GeminiStreamMessage,
} from "./gemini.ws.types.js";

export interface GeminiWsClientOptions {
  url: string;
  reconnectDelayMs?: number;
  staleMs?: number;
}

const DEFAULT_STALE_MS = 30_000;

export class GeminiWsClient extends EventEmitter {
  private readonly url: string;
  private readonly reconnectDelayMs: number;
  private readonly staleMs: number;
  private ws: WebSocket | null = null;
  private readonly subscriptions = new Set<string>();
  private requestId = 1;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private staleTimer: NodeJS.Timeout | undefined;
  private shouldReconnect = true;

  constructor(options: GeminiWsClientOptions) {
    super();
    this.url = options.url;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 2_000;
    this.staleMs = options.staleMs ?? DEFAULT_STALE_MS;
    this.on("error", () => {});
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      logger.info("gemini-ws", "connected");
      this.emit("connected");

      if (this.subscriptions.size > 0) {
        this.sendSubscribe([...this.subscriptions]);
      }
      this.scheduleStaleCheck();
    });

    this.ws.on("message", (data) => {
      this.touchActivity();
      this.handleMessage(data.toString());
    });

    this.ws.on("close", () => {
      this.clearStaleTimer();
      logger.info("gemini-ws", "disconnected");
      this.emit("disconnected");
      this.scheduleReconnect();
    });

    this.ws.on("error", (error) => {
      logger.error("gemini-ws", "socket error", error);
      this.emit("error", error);
    });
  }

  subscribe(streams: string[]): void {
    const newStreams = streams.filter((stream) => !this.subscriptions.has(stream));
    streams.forEach((stream) => this.subscriptions.add(stream));

    if (newStreams.length === 0 || this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sendSubscribe(newStreams);
    this.scheduleStaleCheck();
  }

  unsubscribe(streams: string[]): void {
    const removedStreams = streams.filter((stream) => this.subscriptions.has(stream));
    streams.forEach((stream) => this.subscriptions.delete(stream));

    if (removedStreams.length === 0 || this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.sendUnsubscribe(removedStreams);
    if (this.subscriptions.size === 0) {
      this.clearStaleTimer();
    }
  }

  close(): void {
    this.shouldReconnect = false;
    this.clearStaleTimer();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private scheduleStaleCheck(): void {
    this.clearStaleTimer();
    if (this.subscriptions.size === 0) {
      return;
    }

    this.staleTimer = setTimeout(() => {
      logger.warn("gemini-ws", "stale connection — forcing reconnect", {
        subscriptions: this.subscriptions.size,
      });
      this.emit("stale");
      this.ws?.close();
    }, this.staleMs);
  }

  private touchActivity(): void {
    this.scheduleStaleCheck();
  }

  private clearStaleTimer(): void {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = undefined;
    }
  }

  private sendSubscribe(streams: string[]): void {
    this.send({
      id: String(this.requestId++),
      method: "SUBSCRIBE",
      params: streams,
    });
  }

  private sendUnsubscribe(streams: string[]): void {
    this.send({
      id: String(this.requestId++),
      method: "UNSUBSCRIBE",
      params: streams,
    });
  }

  private send(payload: { id: string; method: string; params: string[] }): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(payload));
  }

  private handleMessage(raw: string): void {
    let message: GeminiStreamMessage;
    try {
      message = JSON.parse(raw) as GeminiStreamMessage;
    } catch {
      logger.warn("gemini-ws", "failed to parse message");
      return;
    }

    if (isGeminiWsResponse(message)) {
      if (message.error) {
        logger.error("gemini-ws", "subscription error", undefined, {
          code: message.error.code,
          msg: message.error.msg,
        });
      }
      return;
    }

    if (isGeminiBookTickerMessage(message)) {
      this.emit("bookTicker", message);
      return;
    }

    if (isGeminiTradeStreamMessage(message)) {
      this.emit("trade", message);
    }
  }
}
