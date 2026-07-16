import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPortfolioDetail } from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import type { PortfolioDetail } from "../../types/portfolio";
import { formatMoney, formatPct, formatPnL } from "./format";
import styles from "./PortfolioHub.module.css";

export default function OverviewSection() {
  const { portfolioId } = useParams();
  const { setActivePortfolioId, refreshPortfolios } = useActivePortfolio();
  const [detail, setDetail] = useState<PortfolioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portfolioId) {
      return;
    }

    setActivePortfolioId(portfolioId);
    let cancelled = false;
    setLoading(true);

    getPortfolioDetail(portfolioId)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load portfolio");
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
  }, [portfolioId, setActivePortfolioId]);

  useEffect(() => {
    void refreshPortfolios();
  }, [detail?.cashBalance, refreshPortfolios]);

  if (loading) {
    return <p className={styles.message}>Loading overview…</p>;
  }

  if (error || !detail) {
    return (
      <div className={styles.error} role="alert">
        {error ?? "Portfolio unavailable"}
      </div>
    );
  }

  const { summary, positions, allocation } = detail;

  return (
    <>
      <p className={styles.lead}>
        Positions, cash, and allocation for this paper book.
      </p>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <h2>Equity</h2>
          <p>{formatMoney(summary.totalEquity)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Cash</h2>
          <p>{formatMoney(detail.cashBalance)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Unrealized</h2>
          <p className={summary.totalUnrealizedPnL >= 0 ? styles.positive : styles.negative}>
            {formatPnL(summary.totalUnrealizedPnL)}
          </p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Realized</h2>
          <p className={summary.totalRealizedPnL >= 0 ? styles.positive : styles.negative}>
            {formatPnL(summary.totalRealizedPnL)}
          </p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Return</h2>
          <p className={summary.totalReturnPct >= 0 ? styles.positive : styles.negative}>
            {formatPct(summary.totalReturnPct)}
          </p>
        </article>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Allocation</h2>
        <div className={styles.allocation}>
          {allocation.map((item) => (
            <div key={item.symbol} className={styles.allocationRow}>
              <span>{item.symbol}</span>
              <div className={styles.allocationBarTrack}>
                <div
                  className={styles.allocationBarFill}
                  style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                />
              </div>
              <span>{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Positions</h2>
        {positions.length === 0 ? (
          <p className={styles.message}>
            No open positions.{" "}
            <Link className={styles.inlineLink} to={`/portfolio/${portfolioId}/trade`}>
              Place a trade
            </Link>
            .
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Avg cost</th>
                  <th>Last</th>
                  <th>Value</th>
                  <th>Unrealized</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id}>
                    <td>{position.symbol}</td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.averageCost)}</td>
                    <td>
                      {position.currentPrice == null
                        ? "—"
                        : formatMoney(position.currentPrice)}
                    </td>
                    <td>
                      {position.marketValue == null
                        ? "—"
                        : formatMoney(position.marketValue)}
                    </td>
                    <td
                      className={
                        (position.unrealizedPnL ?? 0) >= 0
                          ? styles.positive
                          : styles.negative
                      }
                    >
                      {position.unrealizedPnL == null
                        ? "—"
                        : formatPnL(position.unrealizedPnL)}
                    </td>
                    <td>
                      <Link
                        className={styles.inlineLink}
                        to={`/portfolio/${portfolioId}/trade?symbol=${encodeURIComponent(position.symbol)}`}
                      >
                        Trade
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
