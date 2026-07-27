import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMarketSummaries, listSymbols } from "../api/markets";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from "../api/watchlist";
import CoinIcon from "../components/CoinIcon";
import MiniLineChart from "../components/charts/MiniLineChart";
import {
  FocusIcon,
  SearchIcon,
  StarIcon,
  TradeIcon,
} from "../components/icons";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMarketStreams } from "../hooks/useMarketStreams";
import { useTradeNavigation } from "../hooks/useTradeNavigation";
import type { MarketSummary } from "../types/market";
import type { Watchlist } from "../types/watchlist";
import {
  formatPct,
  formatPrice,
  formatVolume,
  quoteAsset,
} from "../utils/format";
import styles from "./MarketsPage.module.css";

type MarketMode = "watchlist" | "top" | "browse";
type QuoteFilter = "USD" | "BTC" | "ETH" | "ALL";

const BROWSE_PAGE_SIZE = 25;
const TOP_LIMIT = 40;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function matchesQuote(symbol: string, quote: QuoteFilter): boolean {
  if (quote === "ALL") return true;
  return symbol.endsWith(`-${quote}`);
}

function matchesLetter(symbol: string, letter: string | null): boolean {
  if (!letter) return true;
  const base = symbol.split("-")[0] ?? symbol;
  return base.toUpperCase().startsWith(letter);
}

function matchesText(symbol: string, query: string): boolean {
  if (!query.trim()) return true;
  return symbol.toUpperCase().includes(query.trim().toUpperCase());
}

export default function MarketsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { exchange } = useSettings();
  const goTrade = useTradeNavigation();

  const [mode, setMode] = useState<MarketMode>("top");
  const [modeReady, setModeReady] = useState(false);
  const [filter, setFilter] = useState("");
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>("USD");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [rows, setRows] = useState<MarketSummary[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [watchlistAction, setWatchlistAction] = useState<string | null>(null);

  const liveSymbols = useMemo(() => {
    if (mode === "browse") return [];
    return rows.map((row) => row.symbol);
  }, [mode, rows]);

  const { connectionState, quotes } = useMarketStreams(liveSymbols);

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlist(null);
      if (!modeReady) {
        setMode("top");
        setModeReady(true);
      }
      return;
    }

    let cancelled = false;
    getWatchlist()
      .then((data) => {
        if (cancelled) return;
        setWatchlist(data);
        if (!modeReady) {
          setMode(data.items.length > 0 ? "watchlist" : "top");
          setModeReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWatchlist(null);
          if (!modeReady) {
            setMode("top");
            setModeReady(true);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, modeReady]);

  useEffect(() => {
    let cancelled = false;
    listSymbols()
      .then((symbols) => {
        if (!cancelled) setAllSymbols(symbols);
      })
      .catch(() => {
        if (!cancelled) setAllSymbols([]);
      });
    return () => {
      cancelled = true;
    };
  }, [exchange]);

  const browseUniverse = useMemo(() => {
    return allSymbols
      .filter((symbol) => matchesQuote(symbol, quoteFilter))
      .filter((symbol) => matchesLetter(symbol, letterFilter))
      .filter((symbol) => matchesText(symbol, filter))
      .sort((a, b) => a.localeCompare(b));
  }, [allSymbols, quoteFilter, letterFilter, filter]);

  const loadRows = useCallback(async () => {
    if (mode === "watchlist" && isAuthenticated && watchlist === null) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "top") {
        const result = await getMarketSummaries({
          quote: "USD",
          limit: TOP_LIMIT,
          offset: 0,
        });
        let items = result.items;
        if (filter.trim()) {
          const q = filter.trim().toUpperCase();
          items = items.filter((item) => item.symbol.includes(q));
        }
        setRows(items);
        setBrowseTotal(result.total);
        return;
      }

      if (mode === "watchlist") {
        const symbols = watchlist?.items.map((item) => item.symbol) ?? [];
        if (symbols.length === 0) {
          setRows([]);
          setBrowseTotal(0);
          return;
        }
        const filtered = symbols.filter((symbol) => matchesText(symbol, filter));
        if (filtered.length === 0) {
          setRows([]);
          setBrowseTotal(0);
          return;
        }
        const result = await getMarketSummaries({ symbols: filtered });
        setRows(result.items);
        setBrowseTotal(result.items.length);
        return;
      }

      // Browse
      const total = browseUniverse.length;
      setBrowseTotal(total);
      const start = page * BROWSE_PAGE_SIZE;
      const pageSymbols = browseUniverse.slice(start, start + BROWSE_PAGE_SIZE);
      if (pageSymbols.length === 0) {
        setRows([]);
        return;
      }
      const result = await getMarketSummaries({ symbols: pageSymbols });
      setRows(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, filter, watchlist, browseUniverse, page, isAuthenticated]);

  useEffect(() => {
    if (!modeReady && isAuthenticated) return;
    void loadRows();
  }, [loadRows, modeReady, isAuthenticated, exchange]);

  useEffect(() => {
    setPage(0);
  }, [mode, quoteFilter, letterFilter, filter]);

  async function handleWatchlistToggle(symbol: string) {
    if (!isAuthenticated) return;
    setWatchlistAction(symbol);
    try {
      const exists = watchlist?.items.some((item) => item.symbol === symbol);
      const updated = exists
        ? await removeWatchlistItem(symbol)
        : await addWatchlistItem(symbol);
      setWatchlist(updated);
      if (mode === "watchlist" && exists) {
        setRows((prev) => prev.filter((row) => row.symbol !== symbol));
      }
    } finally {
      setWatchlistAction(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(browseTotal / BROWSE_PAGE_SIZE));
  const isLive = connectionState === "connected";

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Markets</h1>
          <p className={styles.lead}>
            Scan pairs, discover new markets, then open Focus for depth.
          </p>
        </div>
        <div className={styles.headerTools}>
          {mode !== "browse" && isLive ? (
            <span className={styles.liveBadge}>
              <span className={`${styles.liveDot} ${styles.liveDotOn}`} />
              Live
            </span>
          ) : null}
          <label className={styles.filterField}>
            <SearchIcon />
            <input
              type="search"
              placeholder="Filter symbols…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className={styles.modeRow} role="tablist" aria-label="Market views">
        {(
          [
            ["watchlist", "Watchlist"],
            ["top", "Top"],
            ["browse", "Browse"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={
              mode === id ? `${styles.modeChip} ${styles.modeChipActive}` : styles.modeChip
            }
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "browse" ? (
        <div className={styles.browseControls}>
          <div className={styles.chipRow} aria-label="Quote currency">
            {(["USD", "BTC", "ETH", "ALL"] as const).map((quote) => (
              <button
                key={quote}
                type="button"
                className={
                  quoteFilter === quote
                    ? `${styles.filterChip} ${styles.filterChipActive}`
                    : styles.filterChip
                }
                onClick={() => setQuoteFilter(quote)}
              >
                {quote === "ALL" ? "All quotes" : quote}
              </button>
            ))}
          </div>
          <div className={styles.letterRow} aria-label="Base asset letter">
            <button
              type="button"
              className={
                letterFilter === null
                  ? `${styles.letterChip} ${styles.letterChipActive}`
                  : styles.letterChip
              }
              onClick={() => setLetterFilter(null)}
            >
              All
            </button>
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className={
                  letterFilter === letter
                    ? `${styles.letterChip} ${styles.letterChipActive}`
                    : styles.letterChip
                }
                onClick={() =>
                  setLetterFilter((current) =>
                    current === letter ? null : letter,
                  )
                }
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className={styles.message}>Loading markets…</p>
      ) : mode === "watchlist" && !isAuthenticated ? (
        <p className={styles.message}>
          <Link className={styles.link} to="/login">
            Log in
          </Link>{" "}
          to save and scan a watchlist.
        </p>
      ) : mode === "watchlist" && rows.length === 0 ? (
        <p className={styles.message}>
          No watched markets yet. Open{" "}
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode("browse")}
          >
            Browse
          </button>{" "}
          or{" "}
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode("top")}
          >
            Top
          </button>{" "}
          and star pairs to follow.
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.message}>No markets match these filters.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Last</th>
                  <th scope="col">24h</th>
                  <th scope="col">Vol</th>
                  <th scope="col" className={styles.sparkCol}>
                    Chart
                  </th>
                  <th scope="col" className={styles.actionsCol}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const live = quotes[row.symbol];
                  const last = live?.last ?? row.last;
                  const watching = watchlist?.items.some(
                    (item) => item.symbol === row.symbol,
                  );
                  const change = row.change24h;
                  const changeClass =
                    change == null
                      ? styles.changeFlat
                      : change > 0
                        ? styles.changeUp
                        : change < 0
                          ? styles.changeDown
                          : styles.changeFlat;

                  return (
                    <tr
                      key={row.symbol}
                      className={styles.row}
                      onClick={() =>
                        navigate(`/markets/${encodeURIComponent(row.symbol)}`)
                      }
                    >
                      <td>
                        <div className={styles.symbolCell}>
                          <CoinIcon symbol={row.symbol} size="sm" />
                          <div>
                            <div className={styles.symbolName}>{row.symbol}</div>
                            <div className={styles.symbolMeta}>
                              {quoteAsset(row.symbol) ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.num}>
                        ${formatPrice(last)}
                      </td>
                      <td className={`${styles.num} ${changeClass}`}>
                        {change == null ? "—" : formatPct(change)}
                      </td>
                      <td className={styles.num}>
                        {formatVolume(row.volume24h)}
                      </td>
                      <td className={styles.sparkCol}>
                        <div
                          className={styles.spark}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MiniLineChart symbol={row.symbol} />
                        </div>
                      </td>
                      <td className={styles.actionsCol}>
                        <div
                          className={styles.rowActions}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {isAuthenticated ? (
                            <button
                              type="button"
                              className={styles.iconAction}
                              aria-label={
                                watching
                                  ? "Remove from watchlist"
                                  : "Add to watchlist"
                              }
                              disabled={watchlistAction === row.symbol}
                              onClick={() => void handleWatchlistToggle(row.symbol)}
                            >
                              <StarIcon filled={Boolean(watching)} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={styles.ghostAction}
                            onClick={() => goTrade(row.symbol)}
                          >
                            <TradeIcon />
                            Trade
                          </button>
                          <button
                            type="button"
                            className={styles.primaryAction}
                            onClick={() =>
                              navigate(
                                `/markets/${encodeURIComponent(row.symbol)}`,
                              )
                            }
                          >
                            <FocusIcon />
                            Focus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {mode === "browse" ? (
            <div className={styles.pagination}>
              <span className={styles.pageMeta}>
                {browseTotal === 0
                  ? "0 markets"
                  : `${page * BROWSE_PAGE_SIZE + 1}–${Math.min(
                      (page + 1) * BROWSE_PAGE_SIZE,
                      browseTotal,
                    )} of ${browseTotal}`}
              </span>
              <div className={styles.pageButtons}>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={page <= 0 || loading}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Previous
                </button>
                <span className={styles.pageIndex}>
                  {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  className={styles.pageButton}
                  disabled={page + 1 >= pageCount || loading}
                  onClick={() =>
                    setPage((current) =>
                      current + 1 >= pageCount ? current : current + 1,
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.pageMetaSolo}>
              {mode === "top"
                ? `Top ${rows.length} by 24h volume`
                : `${rows.length} watched`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
