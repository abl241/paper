import type { ClientMessage, ConnectionState, ServerMessage } from "../types/websocket";
import { getWebSocketUrl } from "./ws";

/** Match backend GeminiWsClient default. */
export const WS_RECONNECT_MS = 2_000;
/** No ticker/trade for this long while "connected" → stale → reconnect. */
export const WS_STALE_MS = 30_000;
/** REST poll considered stale after 2× the configured interval with no success. */
export const REST_STALE_MULTIPLIER = 2;

const MAX_RECONNECT_MS = 30_000;

export interface MarketWebSocketHandle {
  close: () => void;
}

export interface MarketWebSocketOptions {
  symbols: string[];
  onMessage: (message: ServerMessage) => void;
  onStateChange: (state: ConnectionState) => void;
}

/**
 * Gemini market stream with automatic reconnection and stale detection.
 * Re-subscribes after every reconnect; backs off up to 30s between attempts.
 */
export function connectMarketWebSocket(
  options: MarketWebSocketOptions,
): MarketWebSocketHandle {
  const { symbols, onMessage, onStateChange } = options;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let attempt = 0;

  const subscribed = [...symbols];

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearStaleTimer(): void {
    if (staleTimer) {
      clearTimeout(staleTimer);
      staleTimer = null;
    }
  }

  function scheduleStaleCheck(): void {
    clearStaleTimer();
    staleTimer = setTimeout(() => {
      if (stopped) {
        return;
      }
      console.warn("[market-ws] stale — no messages, reconnecting");
      onStateChange("stale");
      ws?.close();
    }, WS_STALE_MS);
  }

  function touchActivity(): void {
    scheduleStaleCheck();
  }

  function send(payload: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer) {
      return;
    }
    onStateChange("connecting");
    const delay = Math.min(
      WS_RECONNECT_MS * 1.5 ** attempt,
      MAX_RECONNECT_MS,
    );
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      attempt += 1;
      openSocket();
    }, delay);
  }

  function openSocket(): void {
    if (stopped) {
      return;
    }

    clearStaleTimer();
    ws = new WebSocket(getWebSocketUrl());

    ws.onopen = () => {
      attempt = 0;
      onStateChange("connected");
      for (const symbol of subscribed) {
        send({ type: "subscribe", symbol });
      }
      scheduleStaleCheck();
    };

    ws.onmessage = (event) => {
      touchActivity();
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === "ticker" || message.type === "trade") {
        onMessage(message);
      }
    };

    ws.onclose = () => {
      clearStaleTimer();
      ws = null;
      if (stopped) {
        return;
      }
      onStateChange("disconnected");
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  onStateChange("connecting");
  openSocket();

  return {
    close: () => {
      stopped = true;
      clearReconnectTimer();
      clearStaleTimer();
      if (ws?.readyState === WebSocket.OPEN) {
        for (const symbol of subscribed) {
          send({ type: "unsubscribe", symbol });
        }
      }
      ws?.close();
      ws = null;
    },
  };
}

export function restStaleMs(pollMs: number): number {
  return pollMs * REST_STALE_MULTIPLIER;
}
