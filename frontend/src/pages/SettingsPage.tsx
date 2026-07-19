import { useMemo, useState } from "react";
import EquityCurveChart, {
  buildPreviewEquityPoints,
} from "../components/charts/EquityCurveChart";
import { useSettings } from "../contexts/SettingsContext";
import {
  CLOCK_FORMAT_LABELS,
  CLOCK_FORMAT_OPTIONS,
  EQUITY_RANGE_LABELS,
  EQUITY_RANGE_OPTIONS,
  EQUITY_RESOLUTION_LABELS,
  EQUITY_RESOLUTION_OPTIONS,
  EQUITY_Y_AXIS_LABELS,
  EQUITY_Y_AXIS_OPTIONS,
  EXCHANGE_LABELS,
  EXCHANGE_OPTIONS,
  PRICE_REFRESH_LABELS,
  PRICE_REFRESH_OPTIONS,
  type ClockFormat,
  type EquityDefaultRange,
  type EquityResolution,
  type EquityYAxis,
  type PreferredExchange,
  type PriceRefreshMs,
} from "../types/settings";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const {
    priceRefreshMs,
    exchange,
    equityResolution,
    equityYAxis,
    equityDefaultRange,
    clockFormat,
    setPriceRefreshMs,
    setExchange,
    setEquityResolution,
    setEquityYAxis,
    setEquityDefaultRange,
    setClockFormat,
    isLoading,
  } = useSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewPoints = useMemo(
    () => buildPreviewEquityPoints(equityResolution, equityDefaultRange),
    [equityResolution, equityDefaultRange],
  );

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
        Choose market data, refresh speed, and how your portfolio value chart
        is sampled and scaled.
      </p>

      {isLoading ? (
        <p className={styles.message}>Loading settings…</p>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>Market data</h2>

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

          <label className={styles.field}>
            <span className={styles.label}>Clock format</span>
            <select
              className={styles.select}
              value={clockFormat}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setClockFormat(event.target.value as ClockFormat),
                )
              }
            >
              {CLOCK_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {CLOCK_FORMAT_LABELS[option]}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Used on charts, trade times, and history timestamps.
            </span>
          </label>

          <h2 className={styles.sectionTitle}>Portfolio value chart</h2>
          <p className={styles.sectionLead}>
            Same idea as Robinhood’s home chart: cash plus open positions marked
            to market over time. Finer sampling shows more movement between
            trades.
          </p>

          <label className={styles.field}>
            <span className={styles.label}>Sampling density</span>
            <select
              className={styles.select}
              value={equityResolution}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setEquityResolution(event.target.value as EquityResolution),
                )
              }
            >
              {EQUITY_RESOLUTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EQUITY_RESOLUTION_LABELS[option]}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              How often portfolio value is marked using market candles. Fine
              uses more points (better for 1D/1W); daily is enough for long
              histories.
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Y-axis scale</span>
            <select
              className={styles.select}
              value={equityYAxis}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setEquityYAxis(event.target.value as EquityYAxis),
                )
              }
            >
              {EQUITY_Y_AXIS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EQUITY_Y_AXIS_LABELS[option]}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              Tight zoom makes small dollar moves readable. Including $0 can
              flatten the line when equity is large.
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Default timespan</span>
            <select
              className={styles.select}
              value={equityDefaultRange}
              disabled={saving}
              onChange={(event) =>
                void runSave(() =>
                  setEquityDefaultRange(
                    event.target.value as EquityDefaultRange,
                  ),
                )
              }
            >
              {EQUITY_RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {EQUITY_RANGE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <span className={styles.label}>Preview</span>
              <span className={styles.hint}>
                Sample data · {EQUITY_RESOLUTION_LABELS[equityResolution]} ·{" "}
                {EQUITY_RANGE_LABELS[equityDefaultRange]}
              </span>
            </div>
            <EquityCurveChart
              points={previewPoints}
              startingCash={10_000}
              previewYAxis={equityYAxis}
              previewRange={equityDefaultRange}
              hideToolbar
            />
          </div>
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
