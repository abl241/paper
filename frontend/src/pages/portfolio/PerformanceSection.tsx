import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPortfolioPerformance } from "../../api/portfolios";
import EquityCurveChart from "../../components/charts/EquityCurveChart";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { PerformanceStats } from "../../types/portfolio";
import { formatMoney, formatPct, formatPnL } from "./format";
import styles from "./PortfolioHub.module.css";

export default function PerformanceSection() {
  const { portfolioId } = useParams();
  const { setActivePortfolioId } = useActivePortfolio();
  const { equityResolution } = useSettings();
  const [stats, setStats] = useState<PerformanceStats | null>(null);
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

    getPortfolioPerformance(portfolioId)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load performance",
          );
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
  }, [portfolioId, equityResolution]);

  if (loading) {
    return <p className={styles.message}>Loading performance…</p>;
  }

  if (error || !stats) {
    return (
      <div className={styles.error} role="alert">
        {error ?? "Performance unavailable"}
      </div>
    );
  }

  return (
    <>
      <p className={styles.lead}>
        Return vs starting cash, closed-trade stats, and equity over time.
      </p>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <h2>Equity</h2>
          <p>{formatMoney(stats.totalEquity)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Return</h2>
          <p className={stats.totalReturnPct >= 0 ? styles.positive : styles.negative}>
            {formatPct(stats.totalReturnPct)}
          </p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Win rate</h2>
          <p>
            {stats.winRate == null
              ? "—"
              : `${(stats.winRate * 100).toFixed(1)}%`}
          </p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Avg win</h2>
          <p>{stats.avgWin == null ? "—" : formatPnL(stats.avgWin)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Avg loss</h2>
          <p>{stats.avgLoss == null ? "—" : formatPnL(stats.avgLoss)}</p>
        </article>
      </div>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <h2>Best trade</h2>
          <p>{stats.bestTrade == null ? "—" : formatPnL(stats.bestTrade)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Worst trade</h2>
          <p>{stats.worstTrade == null ? "—" : formatPnL(stats.worstTrade)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Trades</h2>
          <p>{stats.tradeCount}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Closed</h2>
          <p>{stats.closedTradeCount}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Starting cash</h2>
          <p>{formatMoney(stats.startingCash)}</p>
        </article>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Equity curve</h2>
        <EquityCurveChart
          points={stats.equityCurve}
          startingCash={stats.startingCash}
        />
        <p className={styles.hint}>
          Portfolio value over time (cash + positions marked to market), sampled
          from candle history. Change density and Y-axis zoom in Settings.
        </p>
      </div>
    </>
  );
}
