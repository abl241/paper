import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getCandles,
  getOrderBook,
  getTicker,
  getTrades,
} from "../api/markets";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from "../api/watchlist";
import CoinIcon from "../components/CoinIcon";
import PriceChart from "../components/charts/PriceChart";
import {
  ArrowLeftIcon,
  BookIcon,
  ChartIcon,
  StarIcon,
  TradeIcon,
} from "../components/icons";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMarketStream } from "../hooks/useMarketStream";
import { useTradeNavigation } from "../hooks/useTradeNavigation";
import type { Candle, MarketTrade, OrderBook, Ticker } from "../types/market";
import {
  candleIntervalForRange,
  CHART_RANGE_OPTIONS,
  type ChartRange,
} from "../types/settings";
import { formatTime } from "../utils/datetime";
import { formatPrice, formatQty, formatVolume } from "../utils/format";
import styles from "./MarketFocusPage.module.css";

export default function MarketFocusPage() {
  const { symbol: rawSymbol } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { exchange, clockFormat } = useSettings();
  const goTrade = useTradeNavigation();

  const symbol = useMemo(() => {
    if (!rawSymbol) {
      return null;
    }
    return decodeURIComponent(rawSymbol).toUpperCase();
  }, [rawSymbol]);

  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<MarketTrade[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartRange, setChartRange] = useState<ChartRange>("1W");
  const [chartMode, setChartMode] = useState<"candle" | "line">("candle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);

  const { connectionState, tickerUpdate, lastTradePrice } = useMarketStream(
    symbol ?? undefined,
  );

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getTicker(symbol), getOrderBook(symbol), getTrades(symbol)])
      .then(([nextTicker, nextOrderBook, nextTrades]) => {
        if (cancelled) {
          return;
        }
        setTicker(nextTicker);
        setOrderBook(nextOrderBook);
        setTrades(nextTrades.slice(0, 20));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load market");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, exchange]);

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let cancelled = false;
    setCandlesLoading(true);

    getCandles(symbol, candleIntervalForRange(chartRange))
      .then((data) => {
        if (!cancelled) {
          setCandles(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
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
  }, [symbol, chartRange, exchange]);

  useEffect(() => {
    if (!isAuthenticated || !symbol) {
      setInWatchlist(false);
      return;
    }

    let cancelled = false;
    getWatchlist()
      .then((watchlist) => {
        if (!cancelled) {
          setInWatchlist(watchlist.items.some((item) => item.symbol === symbol));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInWatchlist(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, symbol]);

  const displayTicker = useMemo(() => {
    if (!ticker) {
      return null;
    }

    return {
      ...ticker,
      bid: tickerUpdate?.bid ?? ticker.bid,
      ask: tickerUpdate?.ask ?? ticker.ask,
      last: lastTradePrice ?? tickerUpdate?.last ?? ticker.last,
      updatedAt: tickerUpdate?.timestamp ?? ticker.timestamp,
    };
  }, [ticker, tickerUpdate, lastTradePrice]);

  async function handleWatchlistToggle() {
    if (!symbol || !isAuthenticated) {
      return;
    }

    setWatchlistBusy(true);
    try {
      if (inWatchlist) {
        await removeWatchlistItem(symbol);
        setInWatchlist(false);
      } else {
        await addWatchlistItem(symbol);
        setInWatchlist(true);
      }
    } finally {
      setWatchlistBusy(false);
    }
  }

  if (!symbol) {
    return (
      <section className={styles.page}>
        <p className={styles.message}>Missing market symbol.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate("/markets")}
        >
          <ArrowLeftIcon />
          Markets
        </button>

        <div className={styles.topActions}>
          <span
            className={
              connectionState === "connected"
                ? `${styles.liveBadge} ${styles.liveOn}`
                : styles.liveBadge
            }
          >
            {connectionState === "connected" ? "Live" : "Connecting"}
          </span>

          {isAuthenticated && (
            <button
              type="button"
              className={styles.watchButton}
              disabled={watchlistBusy}
              onClick={() => void handleWatchlistToggle()}
            >
              <StarIcon filled={inWatchlist} />
              {inWatchlist ? "Watching" : "Watch"}
            </button>
          )}

          <button
            type="button"
            className={styles.tradeLink}
            onClick={() => goTrade(symbol ?? undefined)}
          >
            <TradeIcon />
            Trade
          </button>
        </div>
      </div>

      <header className={styles.hero}>
        <CoinIcon symbol={symbol} size="lg" />
        <div>
          <h1 className={styles.title}>{symbol}</h1>
          <p className={styles.subtitle}>Focused market view</p>
        </div>
        {displayTicker && (
          <div className={styles.heroPrice}>
            <span className={styles.heroLabel}>Last</span>
            <strong>${formatPrice(displayTicker.last)}</strong>
          </div>
        )}
      </header>

      {loading && <p className={styles.message}>Loading market…</p>}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {displayTicker && !loading && (
        <div className={styles.statRow}>
          <article className={styles.statCard}>
            <span>Bid</span>
            <strong>${formatPrice(displayTicker.bid)}</strong>
          </article>
          <article className={styles.statCard}>
            <span>Ask</span>
            <strong>${formatPrice(displayTicker.ask)}</strong>
          </article>
          <article className={styles.statCard}>
            <span>Spread</span>
            <strong>
              ${formatPrice(Math.max(0, displayTicker.ask - displayTicker.bid))}
            </strong>
          </article>
          <article className={styles.statCard}>
            <span>24h Vol</span>
            <strong>${formatVolume(displayTicker.volume24h)}</strong>
          </article>
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>
            <ChartIcon /> Chart
          </h2>
          <div className={styles.chartControls}>
            <div className={styles.modeGroup} role="group" aria-label="Chart type">
              <button
                type="button"
                className={
                  chartMode === "candle"
                    ? `${styles.intervalButton} ${styles.intervalActive}`
                    : styles.intervalButton
                }
                onClick={() => setChartMode("candle")}
              >
                Candles
              </button>
              <button
                type="button"
                className={
                  chartMode === "line"
                    ? `${styles.intervalButton} ${styles.intervalActive}`
                    : styles.intervalButton
                }
                onClick={() => setChartMode("line")}
              >
                Line
              </button>
            </div>
            <div className={styles.intervalGroup} role="group" aria-label="Timespan">
              {CHART_RANGE_OPTIONS.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={
                    chartRange === range
                      ? `${styles.intervalButton} ${styles.intervalActive}`
                      : styles.intervalButton
                  }
                  onClick={() => setChartRange(range)}
                >
                  {range === "ALL" ? "All" : range}
                </button>
              ))}
            </div>
          </div>
        </div>
        {candles.length === 0 && candlesLoading ? (
          <p className={styles.message}>Loading chart…</p>
        ) : (
          <PriceChart
            symbol={symbol}
            candles={candles}
            range={chartRange}
            mode={chartMode}
          />
        )}
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>
              <BookIcon /> Order book
            </h2>
          </div>
          {!orderBook ? (
            <p className={styles.message}>No order book data.</p>
          ) : (
            <div className={styles.bookGrid}>
              <div>
                <h3 className={styles.bookTitleBid}>Bids</h3>
                <ul className={styles.bookList}>
                  {orderBook.bids.slice(0, 10).map((level) => (
                    <li key={`bid-${level.price}`}>
                      <span>${formatPrice(level.price)}</span>
                      <span>{formatQty(level.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={styles.bookTitleAsk}>Asks</h3>
                <ul className={styles.bookList}>
                  {orderBook.asks.slice(0, 10).map((level) => (
                    <li key={`ask-${level.price}`}>
                      <span>${formatPrice(level.price)}</span>
                      <span>{formatQty(level.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>
              <TradeIcon /> Recent trades
            </h2>
          </div>
          {trades.length === 0 ? (
            <p className={styles.message}>No recent trades.</p>
          ) : (
            <ul className={styles.tradeList}>
              {trades.map((trade, index) => (
                <li key={`${trade.timestamp}-${index}`}>
                  <span
                    className={
                      trade.side === "buy" ? styles.sideBuy : styles.sideSell
                    }
                  >
                    {trade.side}
                  </span>
                  <span>${formatPrice(trade.price)}</span>
                  <span>{formatQty(trade.quantity)}</span>
                  <span className={styles.tradeTime}>
                    {formatTime(trade.timestamp, clockFormat)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
