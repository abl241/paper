import { useEffect, useRef, useState } from "react";
import { getTicker } from "../api/markets";
import { useSettings } from "../contexts/SettingsContext";
import type {
  ConnectionState,
  ServerMessage,
  TickerUpdate,
} from "../types/websocket";
import {
  connectMarketWebSocket,
  restStaleMs,
} from "../utils/marketStreamConnection";
import { restPollIntervalMs } from "../utils/restPollInterval";

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

    if (exchange !== "gemini") {
      let cancelled = false;
      const pollMs = restPollIntervalMs(priceRefreshMs);
      let lastSuccessAt = 0;
      let staleTimer: ReturnType<typeof setTimeout> | null = null;

      const clearStaleTimer = () => {
        if (staleTimer) {
          clearTimeout(staleTimer);
          staleTimer = null;
        }
      };

      const scheduleStaleCheck = () => {
        clearStaleTimer();
        staleTimer = setTimeout(() => {
          if (cancelled) {
            return;
          }
          console.warn("[market-rest] stale — no successful polls");
          setConnectionState("stale");
        }, restStaleMs(pollMs));
      };

      const poll = async () => {
        try {
          const ticker = await getTicker(symbol);
          if (cancelled) {
            return;
          }

          const update: TickerUpdate = {
            symbol: ticker.symbol,
            bid: ticker.bid,
            ask: ticker.ask,
            last: ticker.last,
            timestamp: ticker.timestamp,
          };
          latestTickerRef.current = update;
          setTickerUpdate(update);
          lastSuccessAt = Date.now();
          setConnectionState("connected");
          scheduleStaleCheck();
        } catch {
          if (!cancelled) {
            const staleFor = Date.now() - lastSuccessAt;
            if (lastSuccessAt === 0 || staleFor >= restStaleMs(pollMs)) {
              setConnectionState("disconnected");
            }
          }
        }
      };

      void poll();
      const timer = window.setInterval(() => void poll(), pollMs);

      return () => {
        cancelled = true;
        clearStaleTimer();
        window.clearInterval(timer);
      };
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

    const handle = connectMarketWebSocket({
      symbols: [symbol],
      onStateChange: setConnectionState,
      onMessage: (message: ServerMessage) => {
        if (message.type === "ticker" && message.data.symbol === symbol) {
          latestTickerRef.current = message.data;
          scheduleFlush();
        }

        if (message.type === "trade" && message.data.symbol === symbol) {
          latestTradeRef.current = message.data.price;
          scheduleFlush();
        }
      },
    });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      handle.close();
    };
  }, [symbol, priceRefreshMs, exchange]);

  return { connectionState, tickerUpdate, lastTradePrice };
}
