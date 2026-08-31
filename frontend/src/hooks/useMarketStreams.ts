import { useEffect, useMemo, useRef, useState } from "react";
import { getMarketSummaries } from "../api/markets";
import { useSettings } from "../contexts/SettingsContext";
import type { ConnectionState, ServerMessage } from "../types/websocket";
import {
  connectMarketWebSocket,
  restStaleMs,
} from "../utils/marketStreamConnection";
import { restPollIntervalMs } from "../utils/restPollInterval";

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
 * Live quotes for a capped symbol set — Gemini via WebSocket, Coinbase via REST polling.
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
          const result = await getMarketSummaries({ symbols: capped });
          if (cancelled) {
            return;
          }

          const next: Record<string, LiveQuote> = {};
          for (const item of result.items) {
            next[item.symbol] = {
              bid: item.bid,
              ask: item.ask,
              last: item.last,
            };
          }
          latestRef.current = next;
          setQuotes(next);
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

      setConnectionState("connecting");
      void poll();
      const timer = window.setInterval(() => void poll(), pollMs);

      return () => {
        cancelled = true;
        clearStaleTimer();
        window.clearInterval(timer);
      };
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

    const subscribed = [...capped];

    const handle = connectMarketWebSocket({
      symbols: subscribed,
      onStateChange: setConnectionState,
      onMessage: (message: ServerMessage) => {
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
      },
    });

    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      handle.close();
    };
  }, [cappedKey, capped, priceRefreshMs, exchange]);

  return { connectionState, quotes };
}
