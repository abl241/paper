import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getTicker, listSymbols } from "../../api/markets";
import {
  executeBuy,
  executeSell,
  getPortfolioDetail,
} from "../../api/portfolios";
import CoinIcon from "../../components/CoinIcon";
import MarketSearchModal from "../../components/MarketSearchModal";
import { ChevronIcon, SearchIcon } from "../../components/icons";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { Ticker } from "../../types/market";
import { formatMoney } from "./format";
import styles from "./PortfolioHub.module.css";

const DEFAULT_SYMBOL = "BTC-USD";
const PRESETS = [0.25, 0.5, 0.75, 1] as const;

type Side = "buy" | "sell";
type AmountMode = "quantity" | "usd";

function baseAsset(symbol: string): string {
  return symbol.split("-")[0] ?? symbol;
}

function formatQty(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  }
  return value.toLocaleString(undefined, {
    maximumSignificantDigits: 6,
  });
}

function parseSideParam(value: string | null): Side {
  return value === "sell" ? "sell" : "buy";
}

export default function TradeSection() {
  const { portfolioId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { exchange } = useSettings();
  const { setActivePortfolioId, refreshPortfolios, activePortfolio } =
    useActivePortfolio();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [side, setSide] = useState<Side>(() =>
    parseSideParam(searchParams.get("side")),
  );
  const [amountMode, setAmountMode] = useState<AmountMode>("usd");
  const [amount, setAmount] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [availableQuantity, setAvailableQuantity] = useState(0);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [tickerLoading, setTickerLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const asset = baseAsset(selectedSymbol);
  const fillPrice = side === "buy" ? ticker?.ask : ticker?.bid;

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

        if (pref || searchParams.get("side")) {
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

  const parsedAmount = Number(amount);

  const resolvedQuantity = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return null;
    }
    if (amountMode === "quantity") {
      return parsedAmount;
    }
    if (!fillPrice || fillPrice <= 0) {
      return null;
    }
    return parsedAmount / fillPrice;
  }, [amountMode, parsedAmount, fillPrice]);

  const resolvedUsd = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return null;
    }
    if (amountMode === "usd") {
      return parsedAmount;
    }
    if (!fillPrice || fillPrice <= 0) {
      return null;
    }
    return parsedAmount * fillPrice;
  }, [amountMode, parsedAmount, fillPrice]);

  const canSubmit =
    resolvedQuantity !== null &&
    resolvedQuantity > 0 &&
    !tickerLoading &&
    !submitting &&
    ticker !== null;

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
    setAmount("");
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

  function applyPreset(fraction: number) {
    if (!fillPrice || fillPrice <= 0) {
      return;
    }

    if (side === "buy") {
      const usd = cashBalance * fraction;
      if (amountMode === "usd") {
        setAmount(usd > 0 ? usd.toFixed(2) : "");
      } else {
        const qty = usd / fillPrice;
        setAmount(qty > 0 ? formatQty(qty) : "");
      }
      return;
    }

    const qty = availableQuantity * fraction;
    if (amountMode === "quantity") {
      setAmount(qty > 0 ? formatQty(qty) : "");
    } else {
      const usd = qty * fillPrice;
      setAmount(usd > 0 ? usd.toFixed(2) : "");
    }
  }

  function switchAmountMode(nextMode: AmountMode) {
    if (nextMode === amountMode) {
      return;
    }

    if (Number.isFinite(parsedAmount) && parsedAmount > 0 && fillPrice && fillPrice > 0) {
      if (nextMode === "usd") {
        setAmount((parsedAmount * fillPrice).toFixed(2));
      } else {
        setAmount(formatQty(parsedAmount / fillPrice));
      }
    }

    setAmountMode(nextMode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portfolioId || resolvedQuantity === null) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const input = { symbol: selectedSymbol, quantity: resolvedQuantity };
      const result =
        side === "buy"
          ? await executeBuy(portfolioId, input)
          : await executeSell(portfolioId, input);

      await refreshAccount(selectedSymbol);
      setAmount("");
      setMessage(
        `${side === "buy" ? "Bought" : "Sold"} ${formatQty(result.trade.quantity)} ${asset} at ${formatMoney(result.trade.executionPrice)}. Cash: ${formatMoney(result.cashBalance)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className={styles.message}>Loading trade desk…</p>;
  }

  return (
    <div className={styles.tradeLayout}>
      <div className={styles.tradePanel}>
        {activePortfolio && (
          <p className={styles.chip}>Trading in: {activePortfolio.name}</p>
        )}

        <div className={styles.sideToggle} role="tablist" aria-label="Order side">
          <button
            type="button"
            role="tab"
            aria-selected={side === "buy"}
            className={
              side === "buy"
                ? `${styles.sideTab} ${styles.sideTabBuyActive}`
                : styles.sideTab
            }
            onClick={() => {
              setSide("buy");
              setError(null);
              setMessage(null);
            }}
          >
            Buy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === "sell"}
            className={
              side === "sell"
                ? `${styles.sideTab} ${styles.sideTabSellActive}`
                : styles.sideTab
            }
            onClick={() => {
              setSide("sell");
              setError(null);
              setMessage(null);
            }}
          >
            Sell
          </button>
        </div>

        <button
          type="button"
          className={styles.symbolPicker}
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <span className={styles.symbolPickerMain}>
            <CoinIcon symbol={selectedSymbol} size="sm" />
            <span>
              <span className={styles.symbolPickerAsset}>{asset}</span>
              <span className={styles.symbolPickerPair}>{selectedSymbol}</span>
            </span>
          </span>
          <span className={styles.symbolPickerAction}>
            <SearchIcon />
            Change
            <ChevronIcon />
          </span>
        </button>

        <div className={styles.accountGrid}>
          <article className={styles.summaryCard}>
            <h2>Cash available</h2>
            <p>{formatMoney(cashBalance)}</p>
          </article>
          <article className={styles.summaryCard}>
            <h2>{asset} available</h2>
            <p>{formatQty(availableQuantity)}</p>
          </article>
        </div>

        <form className={styles.tradeForm} onSubmit={(event) => void handleSubmit(event)}>
          <div className={styles.modeToggle} role="group" aria-label="Amount unit">
            <button
              type="button"
              className={
                amountMode === "usd"
                  ? `${styles.modeTab} ${styles.modeTabActive}`
                  : styles.modeTab
              }
              onClick={() => switchAmountMode("usd")}
            >
              USD
            </button>
            <button
              type="button"
              className={
                amountMode === "quantity"
                  ? `${styles.modeTab} ${styles.modeTabActive}`
                  : styles.modeTab
              }
              onClick={() => switchAmountMode("quantity")}
            >
              {asset}
            </button>
          </div>

          <label className={styles.amountField}>
            <span className={styles.label}>
              {amountMode === "usd" ? "Amount in USD" : `Amount in ${asset}`}
            </span>
            <div className={styles.amountInputWrap}>
              <span className={styles.amountPrefix} aria-hidden="true">
                {amountMode === "usd" ? "$" : asset}
              </span>
              <input
                className={styles.amountInput}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
          </label>

          <div className={styles.presetRow} role="group" aria-label="Quick amounts">
            {PRESETS.map((fraction) => (
              <button
                key={fraction}
                type="button"
                className={styles.presetButton}
                disabled={tickerLoading || !fillPrice}
                onClick={() => applyPreset(fraction)}
              >
                {fraction === 1 ? "Max" : `${fraction * 100}%`}
              </button>
            ))}
          </div>

          <div className={styles.conversionCard}>
            {tickerLoading && <p className={styles.message}>Loading live quote…</p>}
            {ticker && !tickerLoading && (
              <>
                <div className={styles.conversionRow}>
                  <span>Market {side === "buy" ? "ask" : "bid"}</span>
                  <strong>{formatMoney(fillPrice ?? 0)}</strong>
                </div>
                <div className={styles.conversionRow}>
                  <span>You {side === "buy" ? "pay" : "receive"}</span>
                  <strong>
                    {resolvedUsd === null ? "—" : formatMoney(resolvedUsd)}
                  </strong>
                </div>
                <div className={styles.conversionRow}>
                  <span>You {side === "buy" ? "get" : "sell"}</span>
                  <strong>
                    {resolvedQuantity === null
                      ? "—"
                      : `${formatQty(resolvedQuantity)} ${asset}`}
                  </strong>
                </div>
                <p className={styles.conversionHint}>
                  Market order · fills at the live {side === "buy" ? "ask" : "bid"}
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

          <button
            className={
              side === "buy" ? styles.buyButton : styles.sellButton
            }
            type="submit"
            disabled={!canSubmit}
          >
            {submitting
              ? side === "buy"
                ? "Buying…"
                : "Selling…"
              : `${side === "buy" ? "Buy" : "Sell"} ${asset}`}
          </button>
        </form>
      </div>

      <aside className={styles.tradeAside}>
        <h2 className={styles.sectionTitle}>Order preview</h2>
        <p className={styles.hint}>
          Enter a USD amount or an {asset} quantity. Presets use your available{" "}
          {side === "buy" ? "cash" : "position"}.
        </p>
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
        <p className={styles.hint}>
          <Link
            className={styles.inlineLink}
            to={`/markets/${encodeURIComponent(selectedSymbol)}`}
          >
            Open {selectedSymbol} focus view
          </Link>{" "}
          for chart and order book.
        </p>
      </aside>

      <MarketSearchModal
        open={pickerOpen}
        symbols={symbols}
        onClose={() => setPickerOpen(false)}
        onSelect={(symbol) => void handleSymbolChange(symbol)}
        title="Select a market"
        subtitle="Search any pair to trade in this portfolio"
        actionLabel="Select"
      />
    </div>
  );
}
