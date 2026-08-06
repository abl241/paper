import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { listStrategies } from "../../api/strategies";
import {
  getStrategyRun,
  heartbeatStrategyRun,
  startStrategyRun,
  stopStrategyRun,
} from "../../api/strategyRuns";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import type { StrategySummary } from "../../types/strategy";
import type { StrategyRun } from "../../types/strategyRun";
import styles from "./PortfolioHub.module.css";

const HEARTBEAT_MS = 25_000;
const DEFAULT_SYMBOL = "BTC-USD";

function presenceLabel(run: StrategyRun): string {
  if (run.status === "stopped") return "Stopped";
  if (run.presence === "active") return "Live (present)";
  return "Idle — waiting for you";
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function StrategiesSection() {
  const { portfolioId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedSymbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const { setActivePortfolioId, refreshPortfolios } = useActivePortfolio();

  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [run, setRun] = useState<StrategyRun | null>(null);
  const [strategyId, setStrategyId] = useState("");
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        } else if (strategyList.length > 0) {
          const first = strategyList[0];
          setStrategyId(first.id);
          setSymbol(requestedSymbol || first.symbols[0] || DEFAULT_SYMBOL);
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
      });
      setRun(next);
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

  if (loading) {
    return <p className={styles.message}>Loading strategies…</p>;
  }

  const isRunning = run?.status === "running";

  return (
    <div>
      <p className={styles.lead}>
        Run one Strategy Lab strategy on live market candles for this portfolio.
        Paper fills apply while you are present; when you return, missed closed
        bars are catch-up replayed.{" "}
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
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Status</h2>
          <div
            className={styles.summaryGrid}
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <div className={styles.summaryCard}>
              <h2>State</h2>
              <p>{presenceLabel(run)}</p>
            </div>
            <div className={styles.summaryCard}>
              <h2>Strategy</h2>
              <p>
                {run.strategyName} · {run.symbol}
              </p>
            </div>
            <div className={styles.summaryCard}>
              <h2>Last bar</h2>
              <p style={{ fontSize: "0.95rem" }}>
                {formatTime(run.lastProcessedBarTime)}
              </p>
            </div>
          </div>

          {run.lastError ? (
            <div className={styles.error} role="alert">
              {run.lastError}
            </div>
          ) : null}

          <h3 className={styles.sectionTitle}>Run log</h3>
          {run.logs.length === 0 ? (
            <p className={styles.message}>No log lines yet.</p>
          ) : (
            <div className={styles.tableWrap}>
              <pre className={styles.runLog}>
                {[...run.logs].reverse().join("\n")}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
