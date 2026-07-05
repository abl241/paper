import { useEffect, useMemo, useState } from "react";
import { getTicker, listSymbols } from "../api/markets";
import { useMarketStream } from "../hooks/useMarketStream";
import type { Ticker } from "../types/market";
import styles from "./MarketsPage.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      symbols: string[];
      selectedSymbol: string;
      ticker: Ticker | null;
      tickerLoading: boolean;
      tickerError: string | null;
    };

const DEFAULT_SYMBOL = "BTC-USD";

export default function MarketsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    listSymbols()
      .then((symbols) => {
        if (cancelled) {
          return;
        }

        const selectedSymbol = symbols.includes(DEFAULT_SYMBOL)
          ? DEFAULT_SYMBOL
          : (symbols[0] ?? DEFAULT_SYMBOL);

        setState({
          status: "success",
          symbols,
          selectedSymbol,
          ticker: null,
          tickerLoading: true,
          tickerError: null,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load markets";
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSymbol =
    state.status === "success" ? state.selectedSymbol : undefined;

  const { connectionState, tickerUpdate, lastTradePrice } =
    useMarketStream(activeSymbol);

  useEffect(() => {
    if (!activeSymbol) {
      return;
    }

    let cancelled = false;

    setState((current) =>
      current.status === "success"
        ? {
            ...current,
            tickerLoading: true,
            tickerError: null,
          }
        : current,
    );

    getTicker(activeSymbol)
      .then((ticker) => {
        if (!cancelled) {
          setState((current) =>
            current.status === "success"
              ? {
                  ...current,
                  ticker,
                  tickerLoading: false,
                  tickerError: null,
                }
              : current,
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load ticker";
          setState((current) =>
            current.status === "success"
              ? {
                  ...current,
                  ticker: null,
                  tickerLoading: false,
                  tickerError: message,
                }
              : current,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSymbol]);

  const displayTicker = useMemo(() => {
    if (state.status !== "success" || !state.ticker) {
      return null;
    }

    const bid = tickerUpdate?.bid ?? state.ticker.bid;
    const ask = tickerUpdate?.ask ?? state.ticker.ask;
    const last = lastTradePrice ?? tickerUpdate?.last ?? state.ticker.last;

    return {
      ...state.ticker,
      bid,
      ask,
      last,
      updatedAt: tickerUpdate?.timestamp ?? state.ticker.timestamp,
    };
  }, [state, tickerUpdate, lastTradePrice]);

  const formatPrice = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (state.status === "loading") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Markets</h1>
        <p className={styles.message}>Loading trading pairs…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Markets</h1>
        <div className={styles.error} role="alert">
          {state.message}
        </div>
      </section>
    );
  }

  const { symbols, selectedSymbol, tickerLoading, tickerError } = state;

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Markets</h1>
          <p className={styles.lead}>
            Live prices from Gemini via the backend WebSocket relay.
          </p>
        </div>
        <span
          className={
            connectionState === "connected"
              ? `${styles.liveBadge} ${styles.liveBadgeActive}`
              : styles.liveBadge
          }
        >
          {connectionState === "connected" ? "Live" : "Connecting…"}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Trading pair</span>
        <select
          className={styles.select}
          value={selectedSymbol}
          onChange={(event) =>
            setState({
              ...state,
              selectedSymbol: event.target.value,
              ticker: null,
              tickerLoading: true,
              tickerError: null,
            })
          }
        >
          {symbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
      </label>

      {tickerLoading && <p className={styles.message}>Loading ticker…</p>}

      {tickerError && (
        <div className={styles.error} role="alert">
          {tickerError}
        </div>
      )}

      {displayTicker && !tickerLoading && (
        <div className={styles.tickerCard}>
          <div className={styles.tickerHeader}>
            <h2 className={styles.symbol}>{displayTicker.symbol}</h2>
            <p className={styles.updatedAt}>
              Last update: {new Date(displayTicker.updatedAt).toLocaleTimeString()}
            </p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Last</dt>
              <dd>${formatPrice(displayTicker.last)}</dd>
            </div>
            <div>
              <dt>Bid</dt>
              <dd>${formatPrice(displayTicker.bid)}</dd>
            </div>
            <div>
              <dt>Ask</dt>
              <dd>${formatPrice(displayTicker.ask)}</dd>
            </div>
            <div>
              <dt>24h Volume</dt>
              <dd>${displayTicker.volume24h.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
