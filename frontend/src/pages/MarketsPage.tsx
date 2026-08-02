import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMarketSummaries, listSymbols } from "../api/markets";
import { getPortfolioDetail } from "../api/portfolios";
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
import { useActivePortfolio } from "../contexts/ActivePortfolioContext";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { useMarketStreams } from "../hooks/useMarketStreams";
import { useTradeNavigation } from "../hooks/useTradeNavigation";
import type { MarketSummary } from "../types/market";
import type { Watchlist } from "../types/watchlist";
import {
  formatPct,
  formatPrice,
  formatQty,
  formatVolume,
  quoteAsset,
} from "../utils/format";
import styles from "./MarketsPage.module.css";

type MarketMode =
  | "watchlist"
  | "holdings"
  | "gainers"
  | "losers"
  | "top"
  | "browse";
type QuoteFilter = "USD" | "BTC" | "ETH" | "ALL";
type SortKey = "symbol" | "last" | "change" | "volume" | "bid" | "ask";
type SortDir = "asc" | "desc";
type FlashDir = "up" | "down";

interface HoldingInfo {
  quantity: number;
  unrealizedPnL: number | null;
}

const BROWSE_PAGE_SIZE = 25;
const TOP_LIMIT = 40;
const MOVERS_LIMIT = 5;
const GAINERS_LOSERS_LIMIT = 25;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SKELETON_ROWS = 8;

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

/** Absolute $ move implied by last and 24h % change. */
function changeAbs(last: number, changePct: number | undefined): number | null {
  if (changePct == null || !Number.isFinite(changePct) || !Number.isFinite(last)) {
    return null;
  }
  const denom = 1 + changePct / 100;
  if (denom === 0) return null;
  return last - last / denom;
}

function formatChangeAbs(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}$${formatPrice(Math.abs(value))}`;
}

function defaultSort(mode: MarketMode): { key: SortKey; dir: SortDir } {
  if (mode === "top") return { key: "volume", dir: "desc" };
  if (mode === "gainers") return { key: "change", dir: "desc" };
  if (mode === "losers") return { key: "change", dir: "asc" };
  return { key: "symbol", dir: "asc" };
}

function applyTextFilter(items: MarketSummary[], query: string): MarketSummary[] {
  if (!query.trim()) return items;
  const q = query.trim().toUpperCase();
  return items.filter((item) => item.symbol.includes(q));
}

function compareRows(
  a: MarketSummary,
  b: MarketSummary,
  key: SortKey,
  dir: SortDir,
  quotes: Record<string, { bid?: number; ask?: number; last?: number }>,
): number {
  const liveA = quotes[a.symbol];
  const liveB = quotes[b.symbol];
  const mul = dir === "asc" ? 1 : -1;

  switch (key) {
    case "symbol":
      return mul * a.symbol.localeCompare(b.symbol);
    case "last": {
      const av = liveA?.last ?? a.last;
      const bv = liveB?.last ?? b.last;
      return mul * (av - bv);
    }
    case "bid": {
      const av = liveA?.bid ?? a.bid;
      const bv = liveB?.bid ?? b.bid;
      return mul * (av - bv);
    }
    case "ask": {
      const av = liveA?.ask ?? a.ask;
      const bv = liveB?.ask ?? b.ask;
      return mul * (av - bv);
    }
    case "change": {
      const av = a.change24h ?? Number.NEGATIVE_INFINITY;
      const bv = b.change24h ?? Number.NEGATIVE_INFINITY;
      return mul * (av - bv);
    }
    case "volume":
      return mul * (a.volume24h - b.volume24h);
    default:
      return 0;
  }
}

export default function MarketsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { activePortfolioId } = useActivePortfolio();
  const { exchange } = useSettings();
  const goTrade = useTradeNavigation();

  const [mode, setMode] = useState<MarketMode>("top");
  const [modeReady, setModeReady] = useState(false);
  const [filter, setFilter] = useState("");
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilter>("USD");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [rows, setRows] = useState<MarketSummary[]>([]);
  const [moversUniverse, setMoversUniverse] = useState<MarketSummary[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moversLoading, setMoversLoading] = useState(true);
  const [holdingsReady, setHoldingsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [watchlistAction, setWatchlistAction] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Record<string, HoldingInfo>>({});
  const [flashes, setFlashes] = useState<Record<string, FlashDir>>({});
  const prevLastRef = useRef<Record<string, number>>({});

  const heldSymbols = useMemo(() => Object.keys(holdings), [holdings]);

  const liveSymbols = useMemo(() => {
    if (mode === "browse") return [];
    return rows.map((row) => row.symbol);
  }, [mode, rows]);

  const { connectionState, quotes } = useMarketStreams(liveSymbols);

  useEffect(() => {
    const next: Record<string, FlashDir> = {};
    for (const [symbol, quote] of Object.entries(quotes)) {
      if (quote.last == null) continue;
      const prev = prevLastRef.current[symbol];
      if (prev != null && quote.last !== prev) {
        next[symbol] = quote.last > prev ? "up" : "down";
      }
      prevLastRef.current[symbol] = quote.last;
    }
    if (Object.keys(next).length === 0) return;

    setFlashes((current) => ({ ...current, ...next }));
    const timer = window.setTimeout(() => {
      setFlashes((current) => {
        const copy = { ...current };
        for (const key of Object.keys(next)) delete copy[key];
        return copy;
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [quotes]);

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
    if (!isAuthenticated || !activePortfolioId) {
      setHoldings({});
      setHoldingsReady(true);
      return;
    }

    let cancelled = false;
    setHoldingsReady(false);
    getPortfolioDetail(activePortfolioId)
      .then((detail) => {
        if (cancelled) return;
        const next: Record<string, HoldingInfo> = {};
        for (const position of detail.positions) {
          if (position.quantity <= 0) continue;
          next[position.symbol] = {
            quantity: position.quantity,
            unrealizedPnL: position.unrealizedPnL,
          };
        }
        setHoldings(next);
      })
      .catch(() => {
        if (!cancelled) setHoldings({});
      })
      .finally(() => {
        if (!cancelled) setHoldingsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activePortfolioId]);

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

  useEffect(() => {
    let cancelled = false;
    setMoversLoading(true);
    getMarketSummaries({ quote: "USD", limit: TOP_LIMIT, offset: 0 })
      .then((result) => {
        if (!cancelled) setMoversUniverse(result.items);
      })
      .catch(() => {
        if (!cancelled) setMoversUniverse([]);
      })
      .finally(() => {
        if (!cancelled) setMoversLoading(false);
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
    if (mode === "holdings" && isAuthenticated && !holdingsReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "top" || mode === "gainers" || mode === "losers") {
        const result = await getMarketSummaries({
          quote: "USD",
          limit: TOP_LIMIT,
          offset: 0,
        });
        setMoversUniverse(result.items);

        let items = result.items;
        if (mode === "gainers") {
          items = [...items]
            .filter(
              (item) =>
                item.change24h != null &&
                Number.isFinite(item.change24h) &&
                item.change24h > 0,
            )
            .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
            .slice(0, GAINERS_LOSERS_LIMIT);
        } else if (mode === "losers") {
          items = [...items]
            .filter(
              (item) =>
                item.change24h != null &&
                Number.isFinite(item.change24h) &&
                item.change24h < 0,
            )
            .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
            .slice(0, GAINERS_LOSERS_LIMIT);
        }

        items = applyTextFilter(items, filter);
        setRows(items);
        setBrowseTotal(
          mode === "top" ? result.total : items.length,
        );
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

      if (mode === "holdings") {
        if (!isAuthenticated) {
          setRows([]);
          setBrowseTotal(0);
          return;
        }
        const filtered = heldSymbols.filter((symbol) =>
          matchesText(symbol, filter),
        );
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
  }, [
    mode,
    filter,
    watchlist,
    browseUniverse,
    page,
    isAuthenticated,
    holdingsReady,
    heldSymbols,
  ]);

  useEffect(() => {
    if (!modeReady && isAuthenticated) return;
    void loadRows();
  }, [loadRows, modeReady, isAuthenticated, exchange]);

  useEffect(() => {
    setPage(0);
  }, [mode, quoteFilter, letterFilter, filter]);

  useEffect(() => {
    const next = defaultSort(mode);
    setSortKey(next.key);
    setSortDir(next.dir);
  }, [mode]);

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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "symbol" ? "asc" : "desc");
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir, quotes));
  }, [rows, sortKey, sortDir, quotes]);

  const movers = useMemo(() => {
    const withChange = moversUniverse.filter(
      (item) => item.change24h != null && Number.isFinite(item.change24h),
    );
    const gainers = [...withChange]
      .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
      .slice(0, MOVERS_LIMIT);
    const losers = [...withChange]
      .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
      .slice(0, MOVERS_LIMIT);
    const hot = [...moversUniverse]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, MOVERS_LIMIT);
    return { gainers, losers, hot };
  }, [moversUniverse]);

  const pageCount = Math.max(1, Math.ceil(browseTotal / BROWSE_PAGE_SIZE));
  const isLive = connectionState === "connected";

  function sortLabel(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <button
        type="button"
        className={
          active ? `${styles.sortButton} ${styles.sortButtonActive}` : styles.sortButton
        }
        onClick={() => handleSort(key)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span className={styles.sortMark} aria-hidden="true">
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  }

  function openFocus(symbol: string) {
    navigate(`/markets/${encodeURIComponent(symbol)}`);
  }

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Markets</h1>
          <p className={styles.lead}>
            Scan movers, sort the book, then open Focus for depth.
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

      <div className={styles.movers} aria-label="Market movers">
        {(
          [
            ["Gainers", movers.gainers, "up", "gainers"],
            ["Losers", movers.losers, "down", "losers"],
            ["Volume", movers.hot, "flat", "top"],
          ] as const
        ).map(([title, items, tone, targetMode]) => (
          <div
            key={title}
            className={
              mode === targetMode
                ? `${styles.moverPanel} ${styles.moverPanelActive}`
                : styles.moverPanel
            }
          >
            <button
              type="button"
              className={styles.moverPanelHead}
              onClick={() => setMode(targetMode)}
            >
              {title}
              <span className={styles.moverPanelHint}>View all</span>
            </button>
            {moversLoading && items.length === 0 ? (
              <div className={styles.moverSkeletonList}>
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className={styles.moverSkeleton} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className={styles.moverEmpty}>No data yet</p>
            ) : (
              <ul className={styles.moverList}>
                {items.map((item) => {
                  const change = item.change24h;
                  const changeClass =
                    change == null
                      ? styles.changeFlat
                      : change > 0
                        ? styles.changeUp
                        : change < 0
                          ? styles.changeDown
                          : styles.changeFlat;
                  return (
                    <li key={`${title}-${item.symbol}`}>
                      <button
                        type="button"
                        className={styles.moverRow}
                        onClick={() => openFocus(item.symbol)}
                      >
                        <span className={styles.moverSymbol}>
                          <CoinIcon symbol={item.symbol} size="sm" />
                          {item.symbol}
                          {holdings[item.symbol] ? (
                            <span className={styles.heldPill}>Held</span>
                          ) : null}
                        </span>
                        <span className={styles.moverMeta}>
                          {tone === "flat" ? (
                            <span className={styles.moverVol}>
                              {formatVolume(item.volume24h)}
                            </span>
                          ) : (
                            <span className={changeClass}>
                              {change == null ? "—" : formatPct(change)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className={styles.modeRow} role="tablist" aria-label="Market views">
        {(
          [
            ["watchlist", "Watchlist"],
            ["holdings", "Holdings"],
            ["gainers", "Gainers"],
            ["losers", "Losers"],
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
            {id === "holdings" && heldSymbols.length > 0 ? (
              <span className={styles.modeCount}>{heldSymbols.length}</span>
            ) : null}
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
        <div className={styles.tableWrap} aria-busy="true" aria-label="Loading markets">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Last</th>
                <th scope="col">Bid</th>
                <th scope="col">Ask</th>
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
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td>
                    <div className={styles.skeletonSymbol}>
                      <span className={styles.skeletonCircle} />
                      <span className={styles.skeletonBar} style={{ width: "5.5rem" }} />
                    </div>
                  </td>
                  <td>
                    <span className={styles.skeletonBar} style={{ width: "4rem" }} />
                  </td>
                  <td>
                    <span className={styles.skeletonBar} style={{ width: "3.5rem" }} />
                  </td>
                  <td>
                    <span className={styles.skeletonBar} style={{ width: "3.5rem" }} />
                  </td>
                  <td>
                    <span className={styles.skeletonBar} style={{ width: "3rem" }} />
                  </td>
                  <td>
                    <span className={styles.skeletonBar} style={{ width: "2.5rem" }} />
                  </td>
                  <td className={styles.sparkCol}>
                    <span className={styles.skeletonBar} style={{ width: "6rem" }} />
                  </td>
                  <td className={styles.actionsCol}>
                    <span className={styles.skeletonBar} style={{ width: "4.5rem" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : mode === "watchlist" && !isAuthenticated ? (
        <p className={styles.message}>
          <Link className={styles.link} to="/login">
            Log in
          </Link>{" "}
          to save and scan a watchlist.
        </p>
      ) : mode === "holdings" && !isAuthenticated ? (
        <p className={styles.message}>
          <Link className={styles.link} to="/login">
            Log in
          </Link>{" "}
          to see markets you hold in your paper portfolio.
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
      ) : mode === "holdings" && rows.length === 0 ? (
        <p className={styles.message}>
          No open positions.{" "}
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode("top")}
          >
            Scan Top
          </button>{" "}
          and trade from Focus, or open{" "}
          <Link className={styles.link} to="/portfolio">
            Portfolio
          </Link>
          .
        </p>
      ) : mode === "gainers" && rows.length === 0 ? (
        <p className={styles.message}>No gainers in the current top universe.</p>
      ) : mode === "losers" && rows.length === 0 ? (
        <p className={styles.message}>No losers in the current top universe.</p>
      ) : rows.length === 0 ? (
        <p className={styles.message}>No markets match these filters.</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{sortLabel("symbol", "Symbol")}</th>
                  <th scope="col">{sortLabel("last", "Last")}</th>
                  <th scope="col" className={styles.quoteCol}>
                    {sortLabel("bid", "Bid")}
                  </th>
                  <th scope="col" className={styles.quoteCol}>
                    {sortLabel("ask", "Ask")}
                  </th>
                  <th scope="col">{sortLabel("change", "24h")}</th>
                  <th scope="col">{sortLabel("volume", "Vol")}</th>
                  <th scope="col" className={styles.sparkCol}>
                    Chart
                  </th>
                  <th scope="col" className={styles.actionsCol}>
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const live = quotes[row.symbol];
                  const last = live?.last ?? row.last;
                  const bid = live?.bid ?? row.bid;
                  const ask = live?.ask ?? row.ask;
                  const watching = watchlist?.items.some(
                    (item) => item.symbol === row.symbol,
                  );
                  const holding = holdings[row.symbol];
                  const change = row.change24h;
                  const abs = changeAbs(last, change);
                  const changeClass =
                    change == null
                      ? styles.changeFlat
                      : change > 0
                        ? styles.changeUp
                        : change < 0
                          ? styles.changeDown
                          : styles.changeFlat;
                  const flash = flashes[row.symbol];
                  const lastClass = flash
                    ? `${styles.num} ${styles.flash} ${
                        flash === "up" ? styles.flashUp : styles.flashDown
                      }`
                    : styles.num;

                  return (
                    <tr
                      key={row.symbol}
                      className={
                        holding
                          ? `${styles.row} ${styles.rowHeld}`
                          : styles.row
                      }
                      onClick={() => openFocus(row.symbol)}
                    >
                      <td>
                        <div className={styles.symbolCell}>
                          <CoinIcon symbol={row.symbol} size="sm" />
                          <div>
                            <div className={styles.symbolNameRow}>
                              <span className={styles.symbolName}>
                                {row.symbol}
                              </span>
                              {holding ? (
                                <span className={styles.heldPill}>Held</span>
                              ) : null}
                            </div>
                            <div className={styles.symbolMeta}>
                              {holding
                                ? `${formatQty(holding.quantity)} · ${quoteAsset(row.symbol) ?? "—"}`
                                : (quoteAsset(row.symbol) ?? "—")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={lastClass}>${formatPrice(last)}</td>
                      <td className={`${styles.num} ${styles.quoteCol}`}>
                        ${formatPrice(bid)}
                      </td>
                      <td className={`${styles.num} ${styles.quoteCol}`}>
                        ${formatPrice(ask)}
                      </td>
                      <td className={`${styles.num} ${changeClass}`}>
                        <div className={styles.changeStack}>
                          <span>{change == null ? "—" : formatPct(change)}</span>
                          {abs != null ? (
                            <span className={styles.changeAbs}>
                              {formatChangeAbs(abs)}
                            </span>
                          ) : null}
                        </div>
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
                            className={styles.iconAction}
                            aria-label={`Trade ${row.symbol}`}
                            onClick={() => goTrade(row.symbol)}
                          >
                            <TradeIcon />
                          </button>
                          <button
                            type="button"
                            className={styles.iconActionPrimary}
                            aria-label={`Focus ${row.symbol}`}
                            onClick={() => openFocus(row.symbol)}
                          >
                            <FocusIcon />
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
                ? `Top ${rows.length} by 24h volume · sorted by ${sortKey}`
                : mode === "gainers"
                  ? `Top ${rows.length} gainers · sorted by ${sortKey}`
                  : mode === "losers"
                    ? `Top ${rows.length} losers · sorted by ${sortKey}`
                    : mode === "holdings"
                      ? `${rows.length} held · sorted by ${sortKey}`
                      : `${rows.length} watched · sorted by ${sortKey}`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
