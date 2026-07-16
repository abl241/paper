import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTicker, listSymbols } from "../api/markets";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from "../api/watchlist";
import MarketSearchModal from "../components/MarketSearchModal";
import CoinIcon from "../components/CoinIcon";
import MiniLineChart from "../components/charts/MiniLineChart";
import {
  ChartIcon,
  ChevronIcon,
  FocusIcon,
  SearchIcon,
  StarIcon,
  TradeIcon,
} from "../components/icons";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMarketStream } from "../hooks/useMarketStream";
import { useTradeNavigation } from "../hooks/useTradeNavigation";
import type { Ticker } from "../types/market";
import type { Watchlist } from "../types/watchlist";
import { formatPrice, formatVolume } from "../utils/format";
import styles from "./MarketsPage.module.css";

const TOP_MARKET_CANDIDATES = [
  "BTC-USD",
  "ETH-USD",
  "SOL-USD",
  "AVAX-USD",
  "LINK-USD",
  "DOT-USD",
  "LTC-USD",
  "BCH-USD",
  "UNI-USD",
  "AAVE-USD",
  "XRP-USD",
  "DOGE-USD",
] as const;

interface MarketSummary {
  symbol: string;
  ticker: Ticker | null;
}

function QuickPeek({ symbol }: { symbol: string }) {
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const { exchange } = useSettings();
  const { connectionState, tickerUpdate, lastTradePrice } = useMarketStream(symbol);

  useEffect(() => {
    let cancelled = false;
    getTicker(symbol)
      .then((data) => {
        if (!cancelled) {
          setTicker(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTicker(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, exchange]);

  const last = lastTradePrice ?? tickerUpdate?.last ?? ticker?.last;
  const bid = tickerUpdate?.bid ?? ticker?.bid;
  const ask = tickerUpdate?.ask ?? ticker?.ask;
  const isLive = connectionState === "connected";

  return (
    <div className={styles.quickPeek}>
      <div className={styles.quickMeta}>
        <span
          className={
            isLive
              ? `${styles.liveDot} ${styles.liveDotOn}`
              : styles.liveDot
          }
          title={isLive ? "Live" : "REST quote"}
        />
        <span>{isLive ? "Live quote" : "Quote"}</span>
      </div>
      <div className={styles.quickStats}>
        <div>
          <span>Last</span>
          <strong>{last == null ? "—" : `$${formatPrice(last)}`}</strong>
        </div>
        <div>
          <span>Bid</span>
          <strong>{bid == null ? "—" : `$${formatPrice(bid)}`}</strong>
        </div>
        <div>
          <span>Ask</span>
          <strong>{ask == null ? "—" : `$${formatPrice(ask)}`}</strong>
        </div>
      </div>
      <p className={styles.quickHint}>
        Use Focus for the full chart, order book, and trade tape.
      </p>
    </div>
  );
}

export default function MarketsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { exchange } = useSettings();
  const goTrade = useTradeNavigation();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [topMarkets, setTopMarkets] = useState<MarketSummary[]>([]);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [watchlistAction, setWatchlistAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    setPageError(null);

    listSymbols()
      .then(async (allSymbols) => {
        if (cancelled) {
          return;
        }

        setSymbols(allSymbols);

        const availableTop: string[] = TOP_MARKET_CANDIDATES.filter((symbol) =>
          allSymbols.includes(symbol),
        );

        if (availableTop.length === 0 && allSymbols.length > 0) {
          availableTop.push(...allSymbols.slice(0, 8));
        }

        const summaries = await Promise.all(
          availableTop.map(async (symbol) => {
            try {
              const ticker = await getTicker(symbol);
              return { symbol, ticker };
            } catch {
              return { symbol, ticker: null };
            }
          }),
        );

        if (!cancelled) {
          setTopMarkets(summaries);
          setPageLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPageError(
            err instanceof Error ? err.message : "Failed to load markets",
          );
          setPageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [exchange]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist(null);
      return;
    }

    let cancelled = false;
    getWatchlist()
      .then((data) => {
        if (!cancelled) {
          setWatchlist(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWatchlist(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  async function handleWatchlistToggle(symbol: string) {
    if (!isAuthenticated) {
      return;
    }

    setWatchlistAction(symbol);
    try {
      const exists = watchlist?.items.some((item) => item.symbol === symbol);
      const updated = exists
        ? await removeWatchlistItem(symbol)
        : await addWatchlistItem(symbol);
      setWatchlist(updated);
    } finally {
      setWatchlistAction(null);
    }
  }

  if (pageLoading) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Markets</h1>
        <p className={styles.message}>Loading markets…</p>
      </section>
    );
  }

  if (pageError) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Markets</h1>
        <div className={styles.error} role="alert">
          {pageError}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Markets</h1>
          <p className={styles.lead}>Top pairs at a glance. Focus any market for depth.</p>
        </div>
        <button
          type="button"
          className={styles.searchButton}
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
          Search
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <ul className={styles.marketList}>
            {topMarkets.map((market) => {
              const isExpanded = expandedSymbol === market.symbol;
              const watching = watchlist?.items.some(
                (item) => item.symbol === market.symbol,
              );

              return (
                <li
                  key={market.symbol}
                  className={
                    isExpanded
                      ? `${styles.marketRow} ${styles.marketRowOpen}`
                      : styles.marketRow
                  }
                >
                  <div className={styles.rowMain}>
                    <button
                      type="button"
                      className={styles.rowPrimary}
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedSymbol((current) =>
                          current === market.symbol ? null : market.symbol,
                        )
                      }
                    >
                      <CoinIcon symbol={market.symbol} className={styles.coinSlot} />
                      <span className={styles.rowIdentity}>
                        <span className={styles.rowSymbol}>{market.symbol}</span>
                        <span className={styles.rowPrice}>
                          {market.ticker
                            ? `$${formatPrice(market.ticker.last)}`
                            : "—"}
                        </span>
                      </span>
                      <span className={styles.miniChart}>
                        <MiniLineChart symbol={market.symbol} />
                      </span>
                      <span className={styles.rowVolume}>
                        {market.ticker ? (
                          <>
                            <ChartIcon />
                            {formatVolume(market.ticker.volume24h)}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <ChevronIcon open={isExpanded} className={styles.chevron} />
                    </button>

                    <div className={styles.rowActions}>
                      {isAuthenticated && (
                        <button
                          type="button"
                          className={styles.iconAction}
                          aria-label={
                            watching ? "Remove from watchlist" : "Add to watchlist"
                          }
                          disabled={watchlistAction === market.symbol}
                          onClick={() => void handleWatchlistToggle(market.symbol)}
                        >
                          <StarIcon filled={Boolean(watching)} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.focusButton}
                        onClick={() => goTrade(market.symbol)}
                      >
                        <TradeIcon />
                        Trade
                      </button>
                      <button
                        type="button"
                        className={styles.focusButton}
                        onClick={() =>
                          navigate(`/markets/${encodeURIComponent(market.symbol)}`)
                        }
                      >
                        <FocusIcon />
                        Focus
                      </button>
                    </div>
                  </div>

                  {isExpanded && <QuickPeek symbol={market.symbol} />}
                </li>
              );
            })}
          </ul>
        </div>

        <aside className={styles.watchlistPanel}>
          <h2 className={styles.watchlistTitle}>
            <StarIcon /> Watchlist
          </h2>

          {!isAuthenticated && (
            <p className={styles.message}>
              <Link className={styles.link} to="/login">
                Log in
              </Link>{" "}
              to save markets.
            </p>
          )}

          {isAuthenticated && (!watchlist || watchlist.items.length === 0) && (
            <p className={styles.message}>Star a market to save it here.</p>
          )}

          {isAuthenticated && watchlist && watchlist.items.length > 0 && (
            <ul className={styles.watchlistList}>
              {watchlist.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.watchlistItem}
                    onClick={() =>
                      navigate(`/markets/${encodeURIComponent(item.symbol)}`)
                    }
                  >
                    <span>
                      <CoinIcon symbol={item.symbol} size="sm" />
                    </span>
                    <span>{item.symbol}</span>
                    <FocusIcon className={styles.watchlistFocus} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <MarketSearchModal
        open={searchOpen}
        symbols={symbols}
        onClose={() => setSearchOpen(false)}
      />
    </section>
  );
}
