import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getTicker, listSymbols } from "../../api/markets";
import {
  executeBuy,
  executeSell,
  getPortfolioDetail,
} from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { Ticker } from "../../types/market";
import { formatMoney } from "./format";
import styles from "./PortfolioHub.module.css";

const DEFAULT_SYMBOL = "BTC-USD";

export default function TradeSection() {
  const { portfolioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { exchange } = useSettings();
  const { setActivePortfolioId, refreshPortfolios, activePortfolio } =
    useActivePortfolio();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [cashBalance, setCashBalance] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [quantity, setQuantity] = useState("0.001");
  const [submitting, setSubmitting] = useState<"buy" | "sell" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (portfolioId) {
      setActivePortfolioId(portfolioId);
    }
  }, [portfolioId, setActivePortfolioId]);

  useEffect(() => {
    if (!portfolioId) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([listSymbols(), getPortfolioDetail(portfolioId)])
      .then(([nextSymbols, detail]) => {
        if (cancelled) {
          return;
        }

        const pref = searchParams.get("symbol")?.toUpperCase();
        const selected =
          (pref && nextSymbols.includes(pref) && pref) ||
          (nextSymbols.includes(DEFAULT_SYMBOL)
            ? DEFAULT_SYMBOL
            : (nextSymbols[0] ?? DEFAULT_SYMBOL));

        const position = detail.positions.find((item) => item.symbol === selected);

        setSymbols(nextSymbols);
        setSelectedSymbol(selected);
        setCashBalance(detail.cashBalance);
        setAvailableQuantity(position?.quantity ?? 0);
        setLoading(false);

        if (pref) {
          const next = new URLSearchParams(searchParams);
          next.delete("symbol");
          next.delete("side");
          setSearchParams(next, { replace: true });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trade desk");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when portfolio or exchange changes — not on every searchParams tweak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, exchange]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    let cancelled = false;
    setTickerLoading(true);

    getTicker(selectedSymbol)
      .then((data) => {
        if (!cancelled) {
          setTicker(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load price");
          setTicker(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTickerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, exchange]);

  const parsedQuantity = Number(quantity);

  const estimatedCost = useMemo(() => {
    if (!ticker || !Number.isFinite(parsedQuantity)) {
      return null;
    }
    return parsedQuantity * ticker.ask;
  }, [ticker, parsedQuantity]);

  const estimatedProceeds = useMemo(() => {
    if (!ticker || !Number.isFinite(parsedQuantity)) {
      return null;
    }
    return parsedQuantity * ticker.bid;
  }, [ticker, parsedQuantity]);

  async function refreshAccount(symbol: string) {
    if (!portfolioId) {
      return;
    }
    const detail = await getPortfolioDetail(portfolioId);
    const position = detail.positions.find((item) => item.symbol === symbol);
    setCashBalance(detail.cashBalance);
    setAvailableQuantity(position?.quantity ?? 0);
    await refreshPortfolios();
  }

  async function handleSymbolChange(nextSymbol: string) {
    if (!portfolioId) {
      return;
    }
    setError(null);
    setMessage(null);
    setSelectedSymbol(nextSymbol);
    try {
      const detail = await getPortfolioDetail(portfolioId);
      const position = detail.positions.find((item) => item.symbol === nextSymbol);
      setCashBalance(detail.cashBalance);
      setAvailableQuantity(position?.quantity ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh account");
    }
  }

  async function handleSubmit(side: "buy" | "sell") {
    if (!portfolioId) {
      return;
    }

    setSubmitting(side);
    setError(null);
    setMessage(null);

    try {
      const input = { symbol: selectedSymbol, quantity: parsedQuantity };
      const result =
        side === "buy"
          ? await executeBuy(portfolioId, input)
          : await executeSell(portfolioId, input);

      await refreshAccount(selectedSymbol);
      setMessage(
        `${side === "buy" ? "Buy" : "Sell"} filled at ${formatMoney(result.trade.executionPrice)}. Cash: ${formatMoney(result.cashBalance)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return <p className={styles.message}>Loading trade desk…</p>;
  }

  return (
    <div className={styles.tradeLayout}>
      <div>
        <p className={styles.lead}>
          Market orders fill against live quotes for this portfolio.
        </p>
        {activePortfolio && (
          <p className={styles.chip}>Trading in: {activePortfolio.name}</p>
        )}

        <div className={styles.accountGrid}>
          <article className={styles.summaryCard}>
            <h2>Cash available</h2>
            <p>{formatMoney(cashBalance)}</p>
          </article>
          <article className={styles.summaryCard}>
            <h2>Position available</h2>
            <p>
              {availableQuantity} {selectedSymbol.split("-")[0]}
            </p>
          </article>
        </div>

        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
        >
          <label className={styles.field}>
            <span className={styles.label}>Trading pair</span>
            <select
              className={styles.select}
              value={selectedSymbol}
              onChange={(event) => void handleSymbolChange(event.target.value)}
            >
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field} style={{ marginTop: "0.75rem" }}>
            <span className={styles.label}>Quantity</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>

          <div className={styles.quoteCard} style={{ marginTop: "1rem" }}>
            {tickerLoading && <p className={styles.message}>Loading live quote…</p>}
            {ticker && !tickerLoading && (
              <>
                <p>
                  Bid: {formatMoney(ticker.bid)} · Ask: {formatMoney(ticker.ask)} ·
                  Last: {formatMoney(ticker.last)}
                </p>
                <p>
                  Est. buy cost:{" "}
                  {estimatedCost === null ? "—" : formatMoney(estimatedCost)}
                </p>
                <p>
                  Est. sell proceeds:{" "}
                  {estimatedProceeds === null
                    ? "—"
                    : formatMoney(estimatedProceeds)}
                </p>
              </>
            )}
          </div>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {message && <div className={styles.success}>{message}</div>}

          <div className={styles.tradeActions} style={{ marginTop: "1rem" }}>
            <button
              className={styles.buyButton}
              type="button"
              disabled={submitting !== null || tickerLoading}
              onClick={() => void handleSubmit("buy")}
            >
              {submitting === "buy" ? "Buying…" : "Buy"}
            </button>
            <button
              className={styles.sellButton}
              type="button"
              disabled={submitting !== null || tickerLoading}
              onClick={() => void handleSubmit("sell")}
            >
              {submitting === "sell" ? "Selling…" : "Sell"}
            </button>
          </div>
        </form>
      </div>

      <aside>
        <h2 className={styles.sectionTitle}>After you fill</h2>
        <p className={styles.hint}>
          Review fills on{" "}
          <Link className={styles.inlineLink} to={`/portfolio/${portfolioId}/history`}>
            History
          </Link>{" "}
          and performance on{" "}
          <Link
            className={styles.inlineLink}
            to={`/portfolio/${portfolioId}/performance`}
          >
            Performance
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
