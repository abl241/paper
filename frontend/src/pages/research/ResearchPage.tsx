import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listStrategies } from "../../api/strategies";
import {
  createBacktest,
  getBacktest,
  listBacktests,
} from "../../api/research";
import EquityCurveChart from "../../components/charts/EquityCurveChart";
import { useAuth } from "../../contexts/AuthContext";
import type { StrategySummary } from "../../types/strategy";
import type {
  BacktestDetail,
  BacktestRange,
  BacktestSummary,
} from "../../types/research";
import { BACKTEST_RANGES } from "../../types/research";
import type { EquityPoint } from "../../types/portfolio";
import { formatMoney } from "../../utils/format";
import styles from "./ResearchPage.module.css";

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function ResearchPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const strategyFromQuery = searchParams.get("strategyId");

  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [history, setHistory] = useState<BacktestSummary[]>([]);
  const [strategyId, setStrategyId] = useState(strategyFromQuery ?? "");
  const [symbol, setSymbol] = useState("BTC-USD");
  const [range, setRange] = useState<BacktestRange>("30d");
  const [feeBps, setFeeBps] = useState(10);
  const [result, setResult] = useState<BacktestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextStrategies, nextHistory] = await Promise.all([
          listStrategies(),
          listBacktests(),
        ]);
        if (cancelled) return;
        setStrategies(nextStrategies);
        setHistory(nextHistory);

        const initialId =
          strategyFromQuery &&
          nextStrategies.some((item) => item.id === strategyFromQuery)
            ? strategyFromQuery
            : nextStrategies[0]?.id ?? "";

        setStrategyId(initialId);
        const selected = nextStrategies.find((item) => item.id === initialId);
        if (selected?.symbols[0]) {
          setSymbol(selected.symbols[0]);
        }
        if (nextHistory[0]) {
          const detail = await getBacktest(nextHistory[0].id);
          if (!cancelled) setResult(detail);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Research");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, strategyFromQuery]);

  useEffect(() => {
    const selected = strategies.find((item) => item.id === strategyId);
    if (selected?.symbols[0]) {
      setSymbol(selected.symbols[0]);
    }
  }, [strategyId, strategies]);

  const equityPoints: EquityPoint[] = useMemo(() => {
    if (!result) return [];
    return result.equityCurve.map((point) => ({
      t: point.t,
      equity: point.equity,
      kind: "marked" as const,
    }));
  }, [result]);

  async function handleRun() {
    if (!strategyId) return;
    setRunning(true);
    setError(null);
    try {
      const detail = await createBacktest({
        strategyId,
        symbol: symbol.trim().toUpperCase() || undefined,
        range,
        feeBps,
      });
      setResult(detail);
      const nextHistory = await listBacktests();
      setHistory(nextHistory);
      if (strategyFromQuery) {
        setSearchParams({}, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleSelectHistory(id: string) {
    setError(null);
    try {
      const detail = await getBacktest(id);
      setResult(detail);
      setStrategyId(detail.strategyId);
      setSymbol(detail.symbol);
      setRange(detail.rangeLabel);
      setFeeBps(detail.feeBps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backtest");
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Research</h1>
        <p className={styles.muted}>Loading…</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Research</h1>
          <p className={styles.subtitle}>
            Backtest strategies on historical candles. Live paper runs come later.
          </p>
        </div>
        <Link className={styles.link} to="/strategy-lab">
          Open Strategy Lab
        </Link>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Run config</h2>
        {strategies.length === 0 ? (
          <p className={styles.muted}>
            No strategies yet.{" "}
            <Link className={styles.link} to="/strategy-lab">
              Create one in Strategy Lab
            </Link>
            .
          </p>
        ) : (
          <div className={styles.formRow}>
            <label className={styles.field}>
              <span>Strategy</span>
              <select
                value={strategyId}
                onChange={(event) => setStrategyId(event.target.value)}
              >
                {strategies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.validationStatus === "valid" ? "" : ` (${item.validationStatus})`}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Symbol</span>
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Range</span>
              <select
                value={range}
                onChange={(event) =>
                  setRange(event.target.value as BacktestRange)
                }
              >
                {BACKTEST_RANGES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Fee (bps)</span>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                value={feeBps}
                onChange={(event) => setFeeBps(Number(event.target.value) || 0)}
              />
            </label>

            <div className={styles.runWrap}>
              <button
                type="button"
                className={styles.runButton}
                disabled={running || !strategyId}
                onClick={handleRun}
              >
                {running ? "Running…" : "Run backtest"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Results</h2>
        {!result ? (
          <p className={styles.muted}>Run a backtest to see equity and trades.</p>
        ) : result.status === "failed" ? (
          <div className={styles.error} role="alert">
            Backtest failed: {result.error ?? "Unknown error"}
          </div>
        ) : (
          <>
            <div className={styles.stats}>
              <div>
                <span className={styles.statLabel}>Return</span>
                <strong>{formatPct(result.stats.totalReturnPct)}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>Max drawdown</span>
                <strong>{formatPct(-Math.abs(result.stats.maxDrawdownPct))}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>Trades</span>
                <strong>{result.stats.tradeCount}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>Win rate</span>
                <strong>{result.stats.winRate.toFixed(1)}%</strong>
              </div>
              <div>
                <span className={styles.statLabel}>Ending equity</span>
                <strong>{formatMoney(result.stats.endingEquity)}</strong>
              </div>
            </div>

            {result.notes.length > 0 ? (
              <ul className={styles.notes}>
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

            <div className={styles.chart}>
              <EquityCurveChart
                points={equityPoints}
                startingCash={result.startingCapital}
                previewRange="ALL"
                emptyMessage="No equity points"
              />
            </div>
          </>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Trades</h2>
        {!result || result.trades.length === 0 ? (
          <p className={styles.muted}>No fills in this run.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((trade, index) => (
                  <tr key={`${trade.time}-${trade.side}-${index}`}>
                    <td>{new Date(trade.time).toLocaleString()}</td>
                    <td className={trade.side === "buy" ? styles.buy : styles.sell}>
                      {trade.side}
                    </td>
                    <td>{trade.quantity.toFixed(6)}</td>
                    <td>{formatMoney(trade.price)}</td>
                    <td>{formatMoney(trade.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>History</h2>
        {history.length === 0 ? (
          <p className={styles.muted}>No backtests yet.</p>
        ) : (
          <ul className={styles.history}>
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={
                    result?.id === item.id
                      ? `${styles.historyItem} ${styles.historyActive}`
                      : styles.historyItem
                  }
                  onClick={() => handleSelectHistory(item.id)}
                >
                  <span className={styles.historyName}>
                    {item.strategyName} · {item.symbol}
                  </span>
                  <span className={styles.historyMeta}>
                    {item.rangeLabel} · {item.status} ·{" "}
                    {item.status === "completed"
                      ? formatPct(item.stats.totalReturnPct)
                      : "—"}{" "}
                    · {new Date(item.createdAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
