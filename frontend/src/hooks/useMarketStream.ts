import { useEffect, useRef, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import type {
  ConnectionState,
  ServerMessage,
  TickerUpdate,
} from "../types/websocket";
import { getWebSocketUrl } from "../utils/ws";

interface LiveMarketState {
  connectionState: ConnectionState;
  tickerUpdate: TickerUpdate | null;
  lastTradePrice: number | null;
}

export function useMarketStream(symbol: string | undefined): LiveMarketState {
  const { priceRefreshMs, exchange } = useSettings();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [tickerUpdate, setTickerUpdate] = useState<TickerUpdate | null>(null);
  const [lastTradePrice, setLastTradePrice] = useState<number | null>(null);

  const latestTickerRef = useRef<TickerUpdate | null>(null);
  const latestTradeRef = useRef<number | null>(null);
  const lastFlushRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    setConnectionState("connecting");
    setTickerUpdate(null);
    setLastTradePrice(null);
    latestTickerRef.current = null;
    latestTradeRef.current = null;
    lastFlushRef.current = 0;

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    // Live WebSocket market stream is Gemini-backed today.
    if (exchange !== "gemini") {
      setConnectionState("disconnected");
      return;
    }

    const flush = () => {
      if (latestTickerRef.current) {
        setTickerUpdate(latestTickerRef.current);
      }
      if (latestTradeRef.current !== null) {
        setLastTradePrice(latestTradeRef.current);
      }
      lastFlushRef.current = Date.now();
      flushTimerRef.current = null;
    };

    const scheduleFlush = () => {
      if (priceRefreshMs === 0) {
        flush();
        return;
      }

      const elapsed = Date.now() - lastFlushRef.current;
      if (elapsed >= priceRefreshMs) {
        flush();
        return;
      }

      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = setTimeout(flush, priceRefreshMs - elapsed);
    };

    const ws = new WebSocket(getWebSocketUrl());

    ws.onopen = () => {
      setConnectionState("connected");
      ws.send(JSON.stringify({ type: "subscribe", symbol }));
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "ticker" && message.data.symbol === symbol) {
        latestTickerRef.current = message.data;
        scheduleFlush();
      }

      if (message.type === "trade" && message.data.symbol === symbol) {
        latestTradeRef.current = message.data.price;
        scheduleFlush();
      }
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
    };

    ws.onerror = () => {
      setConnectionState("disconnected");
    };

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
      }
      ws.close();
    };
  }, [symbol, priceRefreshMs, exchange]);

  return { connectionState, tickerUpdate, lastTradePrice };
}
