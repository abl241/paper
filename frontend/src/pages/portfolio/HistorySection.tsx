import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getPortfolioTrades } from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { Trade } from "../../types/portfolio";
import { formatDateTime } from "../../utils/datetime";
import { formatMoney, formatPnL } from "./format";
import styles from "./PortfolioHub.module.css";

type SourceFilter = "" | "strategy" | "manual";

export default function HistorySection() {
  const { portfolioId } = useParams();
  const [searchParams] = useSearchParams();
  const { setActivePortfolioId } = useActivePortfolio();
  const { clockFormat } = useSettings();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"" | "buy" | "sell">("");
  const [source, setSource] = useState<SourceFilter>(() => {
    const value = searchParams.get("source");
    return value === "strategy" || value === "manual" ? value : "";
  });
  const [strategyRunId] = useState(
    () => searchParams.get("strategyRunId")?.trim() || "",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    getPortfolioTrades(portfolioId, {
      symbol: symbol.trim() ? symbol.trim().toUpperCase() : undefined,
      side: side || undefined,
      from: from || undefined,
      to: to || undefined,
      source: source || undefined,
      strategyRunId: strategyRunId || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setTrades(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trades");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [portfolioId, symbol, side, source, strategyRunId, from, to]);

  return (
    <>
      <p className={styles.lead}>
        Filterable fill history for this portfolio
        {strategyRunId ? " (filtered to one strategy run)." : "."}
      </p>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.label}>Symbol</span>
          <input
            className={styles.input}
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="BTC-USD"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Side</span>
          <select
            className={styles.select}
            value={side}
            onChange={(event) =>
              setSide(event.target.value as "" | "buy" | "sell")
            }
          >
            <option value="">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Source</span>
          <select
            className={styles.select}
            value={source}
            onChange={(event) =>
              setSource(event.target.value as SourceFilter)
            }
          >
            <option value="">All</option>
            <option value="strategy">Strategy</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>From</span>
          <input
            className={styles.input}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>To</span>
          <input
            className={styles.input}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>

      {loading && <p className={styles.message}>Loading history…</p>}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {!loading && !error && trades.length === 0 && (
        <p className={styles.message}>No trades match these filters.</p>
      )}

      {!loading && trades.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Source</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Realized</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{formatDateTime(trade.executedAt, clockFormat)}</td>
                  <td>{trade.symbol}</td>
                  <td className={trade.side === "buy" ? styles.buy : styles.sell}>
                    {trade.side}
                  </td>
                  <td>{trade.strategyRunId ? "Strategy" : "Manual"}</td>
                  <td>{trade.quantity}</td>
                  <td>{formatMoney(trade.executionPrice)}</td>
                  <td>
                    {trade.realizedPnL == null
                      ? "—"
                      : formatPnL(trade.realizedPnL)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
