import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getCandles } from "../../api/markets";
import { listStrategies } from "../../api/strategies";
import {
  getStrategyRun,
  heartbeatStrategyRun,
  startStrategyRun,
  stopStrategyRun,
} from "../../api/strategyRuns";
import EquityCurveChart from "../../components/charts/EquityCurveChart";
import PriceChart from "../../components/charts/PriceChart";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { Candle } from "../../types/market";
import type { StrategySummary } from "../../types/strategy";
import type { StrategyRun } from "../../types/strategyRun";
import { formatDateTime } from "../../utils/datetime";
import {
  buildCumulativeRealizedPoints,
  candleIntervalForStrategyTimeframe,
  tradesToPriceMarkers,
} from "../../utils/strategyCharts";
import { formatMoney, formatPnL } from "./format";
import styles from "./PortfolioHub.module.css";

const HEARTBEAT_MS = 25_000;
const CANDLE_REFRESH_MS = 90_000;
const DEFAULT_SYMBOL = "BTC-USD";

function presenceHeadline(run: StrategyRun): string {
  if (run.status === "stopped") return "Stopped";
  if (run.presence === "active") return "Watching live candles";
  return "Armed — open this tab to process new bars";
}

function presenceDetail(run: StrategyRun): string {
  if (run.status === "stopped") {
    return "This run is no longer trading. Start again to arm the strategy on new closed bars.";
  }
  if (run.presence === "active") {
    return "This page is sending heartbeats, so closed bars are evaluated and paper fills can happen.";
  }
  return "The strategy stays armed, but bars only process while this Strategies tab is open (heartbeat every ~25s).";
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatWinRate(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(0)}%`;
}

export default function StrategiesSection() {
  const { portfolioId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedSymbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const { setActivePortfolioId, refreshPortfolios } = useActivePortfolio();
  const { clockFormat } = useSettings();

  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [run, setRun] = useState<StrategyRun | null>(null);
  const [strategyId, setStrategyId] = useState("");
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [protectManual, setProtectManual] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (portfolioId) {
      setActivePortfolioId(portfolioId);
    }
  }, [portfolioId, setActivePortfolioId]);

  useEffect(() => {
    if (!portfolioId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [strategyList, activeRun] = await Promise.all([
          listStrategies(),
          getStrategyRun(portfolioId!),
        ]);
        if (cancelled) return;

        setStrategies(strategyList);
        setRun(activeRun);

        if (activeRun?.status === "running") {
          setStrategyId(activeRun.strategyId);
          setSymbol(activeRun.symbol);
          setProtectManual(activeRun.protectManualPositions !== false);
        } else if (strategyList.length > 0) {
          const first = strategyList[0];
          setStrategyId(first.id);
          setSymbol(requestedSymbol || first.symbols[0] || DEFAULT_SYMBOL);
        }

        if (activeRun && activeRun.logs.length > 0) {
          setLogOpen(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [portfolioId, requestedSymbol]);

  useEffect(() => {
    if (!portfolioId || run?.status !== "running") return;

    let cancelled = false;

    async function beat() {
      if (!portfolioId || cancelled) return;
      try {
        const next = await heartbeatStrategyRun(portfolioId);
        if (!cancelled) {
          setRun(next);
          void refreshPortfolios();
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Heartbeat failed",
          );
        }
      }
    }

    void beat();
    const id = window.setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [portfolioId, run?.status, refreshPortfolios]);

  const chartSymbol = run?.symbol ?? symbol.trim().toUpperCase();
  const chartTimeframe = run?.timeframe;
  const chartExchange = run?.exchange ?? null;
  const tradeCount = run?.trades.length ?? 0;

  const refreshCandles = useCallback(async () => {
    if (!chartSymbol || !chartTimeframe) {
      setCandles([]);
      return;
    }

    setCandlesLoading(true);
    setCandleError(null);
    try {
      const interval = candleIntervalForStrategyTimeframe(
        chartTimeframe,
        chartExchange,
      );
      const next = await getCandles(chartSymbol, interval, {
        exchange: chartExchange,
      });
      setCandles(next);
    } catch (err) {
      setCandleError(
        err instanceof Error ? err.message : "Failed to load candles",
      );
    } finally {
      setCandlesLoading(false);
    }
  }, [chartExchange, chartSymbol, chartTimeframe]);

  useEffect(() => {
    if (!run) {
      setCandles([]);
      return;
    }

    void refreshCandles();
    const id = window.setInterval(() => void refreshCandles(), CANDLE_REFRESH_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [run?.id, run?.status, tradeCount, refreshCandles]);

  const onStrategyChange = useCallback(
    (nextId: string) => {
      setStrategyId(nextId);
      if (run?.status === "running") return;
      const selected = strategies.find((item) => item.id === nextId);
      if (!requestedSymbol && selected?.symbols[0]) {
        setSymbol(selected.symbols[0]);
      }
    },
    [requestedSymbol, run?.status, strategies],
  );

  async function handleStart() {
    if (!portfolioId || !strategyId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await startStrategyRun(portfolioId, {
        strategyId,
        symbol: symbol.trim() || undefined,
        protectManualPositions: protectManual,
      });
      setRun(next);
      setLogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!portfolioId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await stopStrategyRun(portfolioId);
      setRun(next);
      void refreshPortfolios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop");
    } finally {
      setBusy(false);
    }
  }

  const markers = useMemo(() => {
    if (!run) return [];
    return tradesToPriceMarkers(
      run.trades.map((trade) => ({
        time: trade.executedAt,
        side: trade.side,
        price: trade.executionPrice,
      })),
    );
  }, [run]);

  const pnlPoints = useMemo(() => {
    if (!run) return [];
    return buildCumulativeRealizedPoints(run.trades, run.createdAt);
  }, [run]);

  const hasRealizedFills = useMemo(
    () => (run?.trades.some((trade) => trade.realizedPnL != null) ?? false),
    [run],
  );

  if (loading) {
    return <p className={styles.message}>Loading strategies…</p>;
  }

  const isRunning = run?.status === "running";
  const stats = run?.stats;
  const trades = run?.trades ?? [];

  return (
    <div>
      <p className={styles.lead}>
        Run one Strategy Lab strategy on live market candles for this portfolio.
        Paper fills apply while you keep this tab open; when you return, missed
        closed bars are catch-up replayed.{" "}
        <Link className={styles.inlineLink} to="/strategy-lab">
          Open Strategy Lab
        </Link>
      </p>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Live paper run</h2>

        {strategies.length === 0 ? (
          <p className={styles.message}>
            No strategies yet.{" "}
            <Link className={styles.inlineLink} to="/strategy-lab">
              Create one in Strategy Lab
            </Link>
            .
          </p>
        ) : (
          <>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Strategy</span>
                <select
                  className={styles.input}
                  value={strategyId}
                  disabled={isRunning || busy}
                  onChange={(event) => onStrategyChange(event.target.value)}
                >
                  {strategies.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.validationStatus === "valid"
                        ? ""
                        : ` (${item.validationStatus})`}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Symbol</span>
                <input
                  className={styles.input}
                  value={symbol}
                  disabled={isRunning || busy}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="BTC-USD"
                />
              </label>
            </div>

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={protectManual}
                disabled={isRunning || busy}
                onChange={(event) => setProtectManual(event.target.checked)}
              />
              <span>
                Only sell what this strategy buys
                <span className={styles.checkHint}>
                  Manual buys on this symbol stay in the book. Uncheck to let
                  sells close the full position.
                </span>
              </span>
            </label>

            <div className={styles.actionsRow}>
              {isRunning ? (
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={busy}
                  onClick={() => void handleStop()}
                >
                  {busy ? "Stopping…" : "Stop"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busy || !strategyId}
                  onClick={() => void handleStart()}
                >
                  {busy ? "Starting…" : "Start live paper"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {run ? (
        <>
          <div
            className={`${styles.statusStrip} ${
              run.status === "stopped"
                ? styles.statusStopped
                : run.presence === "active"
                  ? styles.statusActive
                  : styles.statusIdle
            }`}
          >
            <div className={styles.statusMain}>
              <span className={styles.statusDot} aria-hidden />
              <div>
                <p className={styles.statusHeadline}>{presenceHeadline(run)}</p>
                <p className={styles.statusDetail}>{presenceDetail(run)}</p>
              </div>
            </div>
            <dl className={styles.statusMeta}>
              <div>
                <dt>Strategy</dt>
                <dd>
                  {run.strategyName} · {run.symbol} · {run.timeframe}
                </dd>
              </div>
              <div>
                <dt>Sells</dt>
                <dd>
                  {run.protectManualPositions
                    ? "Strategy size only"
                    : "Full position"}
                </dd>
              </div>
              <div>
                <dt>Last bar</dt>
                <dd>{formatTime(run.lastProcessedBarTime)}</dd>
              </div>
              <div>
                <dt>Heartbeat</dt>
                <dd>{formatTime(run.lastHeartbeatAt)}</dd>
              </div>
            </dl>
          </div>

          {run.lastError ? (
            <div className={styles.error} role="alert">
              {run.lastError}
            </div>
          ) : null}

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Price &amp; fills</h2>
              {trades.length === 0 ? (
                <span className={styles.chartHint}>
                  Markers appear after the strategy trades
                </span>
              ) : (
                <span className={styles.chartHint}>
                  {trades.length} fill{trades.length === 1 ? "" : "s"} marked
                </span>
              )}
            </div>

            <div className={styles.chartPanel}>
              {candlesLoading && candles.length === 0 ? (
                <p className={styles.message}>Loading candles…</p>
              ) : candleError ? (
                <p className={styles.message}>{candleError}</p>
              ) : (
                <PriceChart
                  symbol={run.symbol}
                  candles={candles}
                  range="ALL"
                  markers={markers}
                  height={420}
                  emptyMessage={
                    run.status === "running"
                      ? "Waiting for candle data for this symbol…"
                      : "No candle data for this run’s symbol."
                  }
                />
              )}
              {trades.length === 0 ? (
                <p className={styles.chartFootnote}>
                  Need new closed bars after arming before the strategy can
                  signal. Keep this tab open while the run is live.
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Run performance</h2>
              {portfolioId ? (
                <Link
                  className={styles.inlineLink}
                  to={`/portfolio/${portfolioId}/history?source=strategy&strategyRunId=${encodeURIComponent(run.id)}`}
                >
                  Open in History
                </Link>
              ) : null}
            </div>

            <div className={styles.statsRow}>
              <div className={styles.summaryCard}>
                <h2>Trades</h2>
                <p>{stats?.tradeCount ?? 0}</p>
              </div>
              <div className={styles.summaryCard}>
                <h2>Buys / Sells</h2>
                <p>
                  {stats?.buyCount ?? 0} / {stats?.sellCount ?? 0}
                </p>
              </div>
              <div className={styles.summaryCard}>
                <h2>Realized PnL</h2>
                <p>{formatPnL(stats?.realizedPnL ?? 0)}</p>
              </div>
              <div className={styles.summaryCard}>
                <h2>Win rate</h2>
                <p>{formatWinRate(stats?.winRate ?? null)}</p>
              </div>
            </div>

            <div className={styles.pnlChart}>
              <h3 className={styles.pnlChartTitle}>Cumulative realized PnL</h3>
              {hasRealizedFills ? (
                <EquityCurveChart
                  points={pnlPoints}
                  startingCash={0}
                  previewRange="ALL"
                  hideToolbar
                  emptyMessage="No realized PnL yet — appears after closing sells."
                />
              ) : (
                <p className={styles.message}>
                  Cumulative realized PnL appears after closing sells. Open buys
                  alone do not move this curve.
                </p>
              )}
            </div>

            {trades.length === 0 ? (
              <p className={styles.message}>
                No fills for this run yet. New closed bars after arming are
                required before the strategy can trade.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Realized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id}>
                        <td>
                          {formatDateTime(trade.executedAt, clockFormat)}
                        </td>
                        <td
                          className={
                            trade.side === "buy" ? styles.buy : styles.sell
                          }
                        >
                          {trade.side}
                        </td>
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
          </div>

          <div className={styles.section}>
            <button
              type="button"
              className={styles.logToggle}
              aria-expanded={logOpen}
              onClick={() => setLogOpen((open) => !open)}
            >
              <span>Run log</span>
              <span className={styles.logToggleMeta}>
                {run.logs.length} line{run.logs.length === 1 ? "" : "s"} ·{" "}
                {logOpen ? "Hide" : "Show"}
              </span>
            </button>
            {logOpen ? (
              run.logs.length === 0 ? (
                <p className={styles.message}>No log lines yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <pre className={styles.runLog}>
                    {[...run.logs].reverse().join("\n")}
                  </pre>
                </div>
              )
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
