import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  adjustFunds,
  archivePortfolio,
  getPortfolioDetail,
  resetPortfolio,
  updatePortfolio,
} from "../../api/portfolios";
import { useActivePortfolio } from "../../contexts/ActivePortfolioContext";
import type { PreferredExchange } from "../../types/portfolio";
import { EXCHANGE_LABELS, EXCHANGE_OPTIONS } from "../../types/settings";
import { formatMoney } from "./format";
import styles from "./PortfolioHub.module.css";

export default function SettingsSection() {
  const { portfolioId } = useParams();
  const navigate = useNavigate();
  const { setActivePortfolioId, refreshPortfolios } = useActivePortfolio();

  const [name, setName] = useState("");
  const [exchange, setExchange] = useState<"" | PreferredExchange>("");
  const [cashBalance, setCashBalance] = useState(0);
  const [startingCash, setStartingCash] = useState(0);
  const [fundType, setFundType] = useState<"deposit" | "withdraw">("deposit");
  const [fundAmount, setFundAmount] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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

    getPortfolioDetail(portfolioId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setName(detail.portfolio.name);
        setExchange(detail.portfolio.exchange ?? "");
        setCashBalance(detail.cashBalance);
        setStartingCash(detail.portfolio.startingCash);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
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

  async function handleSaveMeta() {
    if (!portfolioId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updatePortfolio(portfolioId, {
        name: name.trim(),
        exchange: exchange === "" ? null : exchange,
      });
      await refreshPortfolios();
      setMessage("Portfolio settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleFunds() {
    if (!portfolioId) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const detail = await adjustFunds(portfolioId, {
        type: fundType,
        amount: Number(fundAmount),
      });
      setCashBalance(detail.cashBalance);
      await refreshPortfolios();
      setMessage(
        `${fundType === "deposit" ? "Deposited" : "Withdrew"} ${formatMoney(Number(fundAmount))}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funds update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!portfolioId) {
      return;
    }
    if (
      !window.confirm(
        "Reset this portfolio? Positions and trades will be cleared and cash restored to starting balance.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const detail = await resetPortfolio(portfolioId);
      setCashBalance(detail.cashBalance);
      await refreshPortfolios();
      setMessage("Portfolio reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!portfolioId) {
      return;
    }
    if (!window.confirm("Archive this portfolio? You won’t be able to trade it.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await archivePortfolio(portfolioId);
      const items = await refreshPortfolios();
      const next = items[0];
      if (next) {
        setActivePortfolioId(next.id);
        navigate(`/portfolio/${next.id}`);
      } else {
        navigate("/portfolio");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={styles.message}>Loading settings…</p>;
  }

  return (
    <>
      <p className={styles.lead}>
        Rename this book, adjust paper cash, override exchange, or reset/archive.
      </p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>General</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Exchange override</span>
            <select
              className={styles.select}
              value={exchange}
              onChange={(event) =>
                setExchange(event.target.value as "" | PreferredExchange)
              }
            >
              <option value="">Use account default</option>
              {EXCHANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EXCHANGE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.hint}>
          Starting cash {formatMoney(startingCash)} · Current cash{" "}
          {formatMoney(cashBalance)}
        </p>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={saving}
            onClick={() => void handleSaveMeta()}
          >
            Save
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Funds</h2>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Action</span>
            <select
              className={styles.select}
              value={fundType}
              onChange={(event) =>
                setFundType(event.target.value as "deposit" | "withdraw")
              }
            >
              <option value="deposit">Deposit</option>
              <option value="withdraw">Withdraw</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Amount (USD)</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="any"
              value={fundAmount}
              onChange={(event) => setFundAmount(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={saving}
            onClick={() => void handleFunds()}
          >
            Apply
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Danger zone</h2>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.ghostButton}
            disabled={saving}
            onClick={() => void handleReset()}
          >
            Reset portfolio
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={saving}
            onClick={() => void handleArchive()}
          >
            Archive portfolio
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {message && <div className={styles.success}>{message}</div>}
    </>
  );
}
