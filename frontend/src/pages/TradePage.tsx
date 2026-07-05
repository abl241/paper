import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTicker, listSymbols } from "../api/markets";
import { getPortfolio } from "../api/portfolio";
import { executeBuy, executeSell } from "../api/trading";
import type { Ticker } from "../types/market";
import styles from "./TradePage.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      symbols: string[];
      selectedSymbol: string;
      cashBalance: number;
      availableQuantity: number;
      ticker: Ticker | null;
      tickerLoading: boolean;
    };

const DEFAULT_SYMBOL = "BTC-USD";

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TradePage() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [quantity, setQuantity] = useState("0.001");
  const [submitting, setSubmitting] = useState<"buy" | "sell" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listSymbols(), getPortfolio()])
      .then(([symbols, portfolio]) => {
        if (cancelled) {
          return;
        }

        const selectedSymbol = symbols.includes(DEFAULT_SYMBOL)
          ? DEFAULT_SYMBOL
          : (symbols[0] ?? DEFAULT_SYMBOL);

        const position = portfolio.positions.find(
          (item) => item.symbol === selectedSymbol,
        );

        setState({
          status: "success",
          symbols,
          selectedSymbol,
          cashBalance: portfolio.cashBalance,
          availableQuantity: position?.quantity ?? 0,
          ticker: null,
          tickerLoading: true,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const errMessage =
            err instanceof Error ? err.message : "Failed to load trade page";
          setState({ status: "error", message: errMessage });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSymbol =
    state.status === "success" ? state.selectedSymbol : undefined;

  useEffect(() => {
    if (!activeSymbol || state.status !== "success") {
      return;
    }

    let cancelled = false;

    setState((current) =>
      current.status === "success"
        ? { ...current, tickerLoading: true }
        : current,
    );

    getTicker(activeSymbol)
      .then((ticker) => {
        if (!cancelled) {
          setState((current) =>
            current.status === "success"
              ? { ...current, ticker, tickerLoading: false }
              : current,
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load price");
          setState((current) =>
            current.status === "success"
              ? { ...current, ticker: null, tickerLoading: false }
              : current,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSymbol, state.status]);

  const parsedQuantity = Number(quantity);

  const estimatedCost = useMemo(() => {
    if (state.status !== "success" || !state.ticker || !Number.isFinite(parsedQuantity)) {
      return null;
    }

    return parsedQuantity * state.ticker.ask;
  }, [state, parsedQuantity]);

  const estimatedProceeds = useMemo(() => {
    if (state.status !== "success" || !state.ticker || !Number.isFinite(parsedQuantity)) {
      return null;
    }

    return parsedQuantity * state.ticker.bid;
  }, [state, parsedQuantity]);

  async function refreshAccount(symbol: string) {
    const portfolio = await getPortfolio();
    const position = portfolio.positions.find((item) => item.symbol === symbol);

    setState((current) =>
      current.status === "success"
        ? {
            ...current,
            cashBalance: portfolio.cashBalance,
            availableQuantity: position?.quantity ?? 0,
          }
        : current,
    );
  }

  async function handleSubmit(side: "buy" | "sell") {
    if (state.status !== "success") {
      return;
    }

    setSubmitting(side);
    setError(null);
    setMessage(null);

    try {
      const input = {
        symbol: state.selectedSymbol,
        quantity: parsedQuantity,
      };

      const result =
        side === "buy" ? await executeBuy(input) : await executeSell(input);

      await refreshAccount(state.selectedSymbol);
      setMessage(
        `${side === "buy" ? "Buy" : "Sell"} filled at ${formatMoney(result.trade.executionPrice)}. Cash balance: ${formatMoney(result.cashBalance)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setSubmitting(null);
    }
  }

  function handleSymbolChange(nextSymbol: string) {
    if (state.status !== "success") {
      return;
    }

    setError(null);
    setMessage(null);

    getPortfolio()
      .then((portfolio) => {
        const position = portfolio.positions.find(
          (item) => item.symbol === nextSymbol,
        );

        setState({
          ...state,
          selectedSymbol: nextSymbol,
          cashBalance: portfolio.cashBalance,
          availableQuantity: position?.quantity ?? 0,
          ticker: null,
          tickerLoading: true,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to refresh account");
      });
  }

  if (state.status === "loading") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Trade</h1>
        <p className={styles.message}>Loading trade form…</p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Trade</h1>
        <div className={styles.error} role="alert">
          {state.message}
        </div>
      </section>
    );
  }

  const { symbols, selectedSymbol, cashBalance, availableQuantity, ticker, tickerLoading } =
    state;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Trade</h1>
      <p className={styles.lead}>
        Place simulated market orders using live Gemini prices from the backend.
      </p>

      <div className={styles.accountGrid}>
        <article className={styles.accountCard}>
          <h2>Cash available</h2>
          <p>{formatMoney(cashBalance)}</p>
        </article>
        <article className={styles.accountCard}>
          <h2>Position available</h2>
          <p>
            {availableQuantity} {selectedSymbol.split("-")[0]}
          </p>
        </article>
      </div>

      <form
        className={styles.form}
        onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
      >
        <label className={styles.field}>
          <span className={styles.label}>Trading pair</span>
          <select
            className={styles.select}
            value={selectedSymbol}
            onChange={(event) => handleSymbolChange(event.target.value)}
          >
            {symbols.map((symbol) => (
              <option key={symbol} value={symbol}>
                {symbol}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
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

        <div className={styles.quoteCard}>
          {tickerLoading && <p className={styles.message}>Loading live quote…</p>}
          {ticker && !tickerLoading && (
            <>
              <p>
                Bid: {formatMoney(ticker.bid)} · Ask: {formatMoney(ticker.ask)} · Last:{" "}
                {formatMoney(ticker.last)}
              </p>
              <p>
                Est. buy cost:{" "}
                {estimatedCost === null ? "—" : formatMoney(estimatedCost)}
              </p>
              <p>
                Est. sell proceeds:{" "}
                {estimatedProceeds === null ? "—" : formatMoney(estimatedProceeds)}
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

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.buyButton}`}
            type="button"
            disabled={submitting !== null || tickerLoading}
            onClick={() => void handleSubmit("buy")}
          >
            {submitting === "buy" ? "Buying…" : "Buy"}
          </button>
          <button
            className={`${styles.button} ${styles.sellButton}`}
            type="button"
            disabled={submitting !== null || tickerLoading}
            onClick={() => void handleSubmit("sell")}
          >
            {submitting === "sell" ? "Selling…" : "Sell"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        Review updated balances on the{" "}
        <Link className={styles.link} to="/portfolio">
          portfolio page
        </Link>
        .
      </p>
    </section>
  );
}
