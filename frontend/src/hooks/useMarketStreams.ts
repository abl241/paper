import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import type { ConnectionState, ServerMessage } from "../types/websocket";
import { getWebSocketUrl } from "../utils/ws";

const MAX_LIVE_SYMBOLS = 15;

export interface LiveQuote {
  bid?: number;
  ask?: number;
  last?: number;
}

interface LiveMarketsState {
  connectionState: ConnectionState;
  quotes: Record<string, LiveQuote>;
}

/**
 * Subscribe to a capped set of symbols over the Gemini market WebSocket.
 */
export function useMarketStreams(symbols: string[]): LiveMarketsState {
  const { priceRefreshMs, exchange } = useSettings();
  const capped = useMemo(() => {
    const unique = [...new Set(symbols.filter(Boolean))];
    return unique.slice(0, MAX_LIVE_SYMBOLS);
  }, [symbols]);

  const cappedKey = capped.join(",");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});

  const latestRef = useRef<Record<string, LiveQuote>>({});
  const lastFlushRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestRef.current = {};
    setQuotes({});
    lastFlushRef.current = 0;

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (capped.length === 0) {
      setConnectionState("disconnected");
      return;
    }

    if (exchange !== "gemini") {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");

    const flush = () => {
      setQuotes({ ...latestRef.current });
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
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(flush, priceRefreshMs - elapsed);
    };

    const ws = new WebSocket(getWebSocketUrl());
    const subscribed = [...capped];

    ws.onopen = () => {
      setConnectionState("connected");
      for (const symbol of subscribed) {
        ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    };

    ws.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "ticker") {
        const { symbol, bid, ask, last } = message.data;
        if (!subscribed.includes(symbol)) return;
        latestRef.current[symbol] = {
          ...latestRef.current[symbol],
          bid,
          ask,
          ...(last !== undefined ? { last } : {}),
        };
        scheduleFlush();
      }

      if (message.type === "trade") {
        const { symbol, price } = message.data;
        if (!subscribed.includes(symbol)) return;
        latestRef.current[symbol] = {
          ...latestRef.current[symbol],
          last: price,
        };
        scheduleFlush();
      }
    };

    ws.onclose = () => setConnectionState("disconnected");
    ws.onerror = () => setConnectionState("disconnected");

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (ws.readyState === WebSocket.OPEN) {
        for (const symbol of subscribed) {
          ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
        }
      }
      ws.close();
    };
  }, [cappedKey, capped, priceRefreshMs, exchange]);

  return { connectionState, quotes };
}
