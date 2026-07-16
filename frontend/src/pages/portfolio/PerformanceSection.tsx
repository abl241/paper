import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getPortfolioPerformance } from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import type { PerformanceStats } from "../../types/portfolio";
import { formatMoney, formatPct, formatPnL } from "./format";
import styles from "./PortfolioHub.module.css";

function EquityCurve({ points }: { points: PerformanceStats["equityCurve"] }) {
  const path = useMemo(() => {
    if (points.length < 2) {
      return null;
    }

    const values = points.map((p) => p.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const width = 640;
    const height = 200;
    const pad = 12;

    return points
      .map((point, index) => {
        const x =
          pad + (index / (points.length - 1)) * (width - pad * 2);
        const y =
          height - pad - ((point.equity - min) / span) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  if (!path) {
    return <p className={styles.message}>Not enough history for a curve yet.</p>;
  }

  return (
    <svg className={styles.curve} viewBox="0 0 640 220" role="img" aria-label="Equity curve">
      <path d={path} fill="none" stroke="#0f172a" strokeWidth="2" />
    </svg>
  );
}

export default function PerformanceSection() {
  const { portfolioId } = useParams();
  const { setActivePortfolioId } = useActivePortfolio();
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
  }, [portfolioId]);

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
        Return vs starting cash, closed-trade stats, and a cash-path equity curve
        with a final marked equity point.
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
        <EquityCurve points={stats.equityCurve} />
        <p className={styles.hint}>
          Intermediate points follow cash after each fill; the last point marks
          open positions at current prices.
        </p>
      </div>
    </>
  );
}
