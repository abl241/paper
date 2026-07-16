import { useState } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  EXCHANGE_LABELS,
  EXCHANGE_OPTIONS,
  PRICE_REFRESH_LABELS,
  PRICE_REFRESH_OPTIONS,
  type PreferredExchange,
  type PriceRefreshMs,
} from "../types/settings";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const {
    priceRefreshMs,
    exchange,
    setPriceRefreshMs,
    setExchange,
    isLoading,
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSave(action: () => Promise<void>) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
      setMessage("Settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.lead}>
        Choose which exchange powers market data and paper fills, and how often
        live prices refresh in the UI.
      </p>

      {isLoading ? (
        <p className={styles.message}>Loading settings…</p>
      ) : (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Market data API</span>
            <select
              className={styles.select}
              value={exchange}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setExchange(event.target.value as PreferredExchange),
                )
              }
            >
              {EXCHANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EXCHANGE_LABELS[option]}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Prices, order books, charts, and paper trade fills use this
              exchange. Live WebSocket updates are currently available for
              Gemini only; Coinbase uses REST refreshes.
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Price refresh interval</span>
            <select
              className={styles.select}
              value={priceRefreshMs}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setPriceRefreshMs(
                    Number(event.target.value) as PriceRefreshMs,
                  ),
                )
              }
            >
              {PRICE_REFRESH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PRICE_REFRESH_LABELS[option]}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Realtime can update many times per second on liquid pairs. 1–5
              seconds is usually enough for paper trading.
            </span>
          </label>
        </>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {message && <div className={styles.success}>{message}</div>}
    </section>
  );
}
