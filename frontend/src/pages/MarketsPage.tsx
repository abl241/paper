import { useEffect, useState } from "react";
import { getTicker, listSymbols } from "../api/markets";
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

  const { symbols, selectedSymbol, ticker, tickerLoading, tickerError } = state;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Markets</h1>
      <p className={styles.lead}>Live prices from Gemini via the backend market service.</p>

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

      {ticker && !tickerLoading && (
        <div className={styles.tickerCard}>
          <h2 className={styles.symbol}>{ticker.symbol}</h2>
          <dl className={styles.stats}>
            <div>
              <dt>Last</dt>
              <dd>${ticker.last.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Bid</dt>
              <dd>${ticker.bid.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Ask</dt>
              <dd>${ticker.ask.toLocaleString()}</dd>
            </div>
            <div>
              <dt>24h Volume</dt>
              <dd>${ticker.volume24h.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
