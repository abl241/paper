import { useEffect, useState } from "react";
import { getPortfolio } from "../api/portfolio";
import type { Portfolio } from "../types/portfolio";
import styles from "./PortfolioPage.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; portfolio: Portfolio };

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPnL(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value))}`;
}

export default function PortfolioPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    getPortfolio()
      .then((portfolio) => {
        if (!cancelled) {
          setState({ status: "success", portfolio });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load portfolio";
          setState({ status: "error", message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portfolio</h1>
        <p className={styles.message}>Loading portfolio…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Portfolio</h1>
        <div className={styles.error} role="alert">
          {state.message}
        </div>
      </section>
    );
  }

  const { portfolio } = state;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Portfolio</h1>
      <p className={styles.lead}>Simulated account overview calculated by the backend.</p>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <h2>Cash balance</h2>
          <p>{formatMoney(portfolio.cashBalance)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Total equity</h2>
          <p>{formatMoney(portfolio.summary.totalEquity)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Unrealized PnL</h2>
          <p>{formatPnL(portfolio.summary.totalUnrealizedPnL)}</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>Realized PnL</h2>
          <p>{formatPnL(portfolio.summary.totalRealizedPnL)}</p>
        </article>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Positions</h2>
        {portfolio.positions.length === 0 ? (
          <p className={styles.message}>No open positions yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Avg cost</th>
                  <th>Last price</th>
                  <th>Market value</th>
                  <th>Unrealized PnL</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((position) => (
                  <tr key={position.id}>
                    <td>{position.symbol}</td>
                    <td>{position.quantity}</td>
                    <td>{formatMoney(position.averageCost)}</td>
                    <td>
                      {position.currentPrice === null
                        ? "—"
                        : formatMoney(position.currentPrice)}
                    </td>
                    <td>
                      {position.marketValue === null
                        ? "—"
                        : formatMoney(position.marketValue)}
                    </td>
                    <td>
                      {position.unrealizedPnL === null
                        ? "—"
                        : formatPnL(position.unrealizedPnL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Trade history</h2>
        {portfolio.trades.length === 0 ? (
          <p className={styles.message}>No trades yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Realized PnL</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{new Date(trade.executedAt).toLocaleString()}</td>
                    <td>{trade.symbol}</td>
                    <td className={trade.side === "buy" ? styles.buy : styles.sell}>
                      {trade.side.toUpperCase()}
                    </td>
                    <td>{trade.quantity}</td>
                    <td>{formatMoney(trade.executionPrice)}</td>
                    <td>
                      {trade.realizedPnL === null
                        ? "—"
                        : formatPnL(trade.realizedPnL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
