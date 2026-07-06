import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { getCandles, getTicker, listSymbols } from "../api/markets";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from "../api/watchlist";
import { useAuth } from "../contexts/AuthContext";
import { useMarketStream } from "../hooks/useMarketStream";
import type { Candle, Ticker } from "../types/market";
import type { Watchlist } from "../types/watchlist";
import PriceChart from "../components/charts/PriceChart";
import styles from "./MarketsPage.module.css";

const CHART_INTERVALS = ["1h", "6h", "1d"] as const;
type ChartInterval = (typeof CHART_INTERVALS)[number];

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

function formatPrice(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MarketsPage() {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistAction, setWatchlistAction] = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState<ChartInterval>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candlesError, setCandlesError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist(null);
      return;
    }

    let cancelled = false;
    setWatchlistLoading(true);
    setWatchlistError(null);

    getWatchlist()
      .then((data) => {
        if (!cancelled) {
          setWatchlist(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWatchlistError(
            err instanceof Error ? err.message : "Failed to load watchlist",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWatchlistLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (!activeSymbol) {
      return;
    }

    let cancelled = false;
    setCandlesLoading(true);
    setCandlesError(null);

    getCandles(activeSymbol, chartInterval)
      .then((data) => {
        if (!cancelled) {
          setCandles(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCandlesError(
            err instanceof Error ? err.message : "Failed to load chart data",
          );
          setCandles([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCandlesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSymbol, chartInterval]);

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

  const watchlistHasSymbol =
    state.status === "success" &&
    watchlist?.items.some((item) => item.symbol === state.selectedSymbol);

  async function handleWatchlistToggle() {
    if (state.status !== "success" || !isAuthenticated) {
      return;
    }

    setWatchlistAction(state.selectedSymbol);
    setWatchlistError(null);

    try {
      const updated = watchlistHasSymbol
        ? await removeWatchlistItem(state.selectedSymbol)
        : await addWatchlistItem(state.selectedSymbol);
      setWatchlist(updated);
    } catch (err) {
      setWatchlistError(
        err instanceof Error ? err.message : "Failed to update watchlist",
      );
    } finally {
      setWatchlistAction(null);
    }
  }

  async function handleRemoveFromWatchlist(symbol: string) {
    setWatchlistAction(symbol);
    setWatchlistError(null);

    try {
      const updated = await removeWatchlistItem(symbol);
      setWatchlist(updated);
    } catch (err) {
      setWatchlistError(
        err instanceof Error ? err.message : "Failed to remove symbol",
      );
    } finally {
      setWatchlistAction(null);
    }
  }

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

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
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

          {isAuthenticated && (
            <button
              className={styles.watchlistButton}
              type="button"
              disabled={watchlistAction !== null}
              onClick={() => void handleWatchlistToggle()}
            >
              {watchlistAction === selectedSymbol
                ? "Saving…"
                : watchlistHasSymbol
                  ? "Remove from watchlist"
                  : "Add to watchlist"}
            </button>
          )}

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
                  Last update:{" "}
                  {new Date(displayTicker.updatedAt).toLocaleTimeString()}
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

          <section className={styles.chartSection}>
            <div className={styles.chartHeader}>
              <h2 className={styles.chartTitle}>Price history</h2>
              <div className={styles.intervalGroup}>
                {CHART_INTERVALS.map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    className={
                      chartInterval === interval
                        ? `${styles.intervalButton} ${styles.intervalButtonActive}`
                        : styles.intervalButton
                    }
                    onClick={() => setChartInterval(interval)}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>

            {candlesLoading && (
              <p className={styles.message}>Loading chart data…</p>
            )}

            {candlesError && (
              <div className={styles.error} role="alert">
                {candlesError}
              </div>
            )}

            {!candlesLoading && !candlesError && (
              <PriceChart
                symbol={selectedSymbol}
                candles={candles}
                interval={chartInterval}
              />
            )}
          </section>
        </div>

        <aside className={styles.watchlistPanel}>
          <h2 className={styles.watchlistTitle}>Watchlist</h2>

          {!isAuthenticated && (
            <p className={styles.message}>
              <Link className={styles.link} to="/login">
                Log in
              </Link>{" "}
              to save symbols.
            </p>
          )}

          {isAuthenticated && watchlistLoading && (
            <p className={styles.message}>Loading watchlist…</p>
          )}

          {isAuthenticated && watchlistError && (
            <div className={styles.error} role="alert">
              {watchlistError}
            </div>
          )}

          {isAuthenticated && !watchlistLoading && watchlist?.items.length === 0 && (
            <p className={styles.message}>No saved symbols yet.</p>
          )}

          {isAuthenticated && watchlist && watchlist.items.length > 0 && (
            <ul className={styles.watchlistList}>
              {watchlist.items.map((item) => (
                <li key={item.id} className={styles.watchlistItem}>
                  <button
                    className={styles.watchlistSymbolButton}
                    type="button"
                    onClick={() =>
                      setState({
                        ...state,
                        selectedSymbol: item.symbol,
                        ticker: null,
                        tickerLoading: true,
                        tickerError: null,
                      })
                    }
                  >
                    <span>{item.symbol}</span>
                    <span>
                      {item.last === null ? "—" : `$${formatPrice(item.last)}`}
                    </span>
                  </button>
                  <button
                    className={styles.removeButton}
                    type="button"
                    aria-label={`Remove ${item.symbol}`}
                    disabled={watchlistAction !== null}
                    onClick={() => void handleRemoveFromWatchlist(item.symbol)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
