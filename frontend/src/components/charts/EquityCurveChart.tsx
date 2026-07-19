import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  createChart,
  LineSeries,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useSettings } from "../../contexts/SettingsContext";
import type { EquityPoint } from "../../types/portfolio";
import type {
  ClockFormat,
  EquityDefaultRange,
  EquityYAxis,
} from "../../types/settings";
import { formatChartDateTime } from "../../utils/datetime";
import { formatMoney, formatPct } from "../../utils/format";
import styles from "./EquityCurveChart.module.css";

export type EquityRange = EquityDefaultRange;

const RANGES: { id: EquityRange; label: string }[] = [
  { id: "1D", label: "1D" },
  { id: "1W", label: "1W" },
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "YTD", label: "YTD" },
  { id: "ALL", label: "All" },
];

interface EquityCurveChartProps {
  points: EquityPoint[];
  startingCash: number;
  className?: string;
  /** Preview / settings: override stored prefs without reading context defaults for range. */
  previewYAxis?: EquityYAxis;
  previewRange?: EquityRange;
  hideToolbar?: boolean;
  emptyMessage?: string;
}

function rangeCutoff(range: EquityRange, now = Date.now()): number | null {
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case "1D":
      return now - day;
    case "1W":
      return now - 7 * day;
    case "1M":
      return now - 30 * day;
    case "3M":
      return now - 90 * day;
    case "YTD":
      return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    case "ALL":
      return null;
  }
}

function toSeriesData(points: EquityPoint[], range: EquityRange) {
  const sorted = [...points].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );

  if (sorted.length === 0) {
    return [];
  }

  const cutoff = rangeCutoff(range);
  let windowPoints = sorted;

  if (cutoff !== null) {
    const before = [...sorted]
      .reverse()
      .find((p) => new Date(p.t).getTime() < cutoff);
    const inside = sorted.filter((p) => new Date(p.t).getTime() >= cutoff);

    windowPoints = [];
    if (before) {
      windowPoints.push({
        t: new Date(cutoff).toISOString(),
        equity: before.equity,
        kind: before.kind,
      });
    }
    windowPoints.push(...inside);
  }

  if (windowPoints.length === 1) {
    const only = windowPoints[0];
    const t = new Date(only.t).getTime();
    windowPoints = [
      {
        t: new Date(t - 60_000).toISOString(),
        equity: only.equity,
        kind: only.kind,
      },
      only,
    ];
  }

  const byTime = new Map<number, number>();
  for (const point of windowPoints) {
    const time = Math.floor(new Date(point.t).getTime() / 1000);
    byTime.set(time, point.equity);
  }

  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({
      time: time as UTCTimestamp,
      value,
    }));
}

function formatAxisPrice(value: number, span: number): string {
  const absSpan = Math.abs(span);
  const digits =
    absSpan < 10 ? 2 : absSpan < 100 ? 2 : absSpan < 1_000 ? 1 : 0;

  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 100_000 && digits === 0) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatCrosshairTime(time: UTCTimestamp, clockFormat: ClockFormat): string {
  return formatChartDateTime(time, clockFormat);
}

function makeAutoscaleProvider(mode: EquityYAxis) {
  return (
    original: () => AutoscaleInfo | null,
  ): AutoscaleInfo | null => {
    const result = original();
    if (!result?.priceRange) {
      return result;
    }

    const { minValue, maxValue } = result.priceRange;
    const span = Math.max(maxValue - minValue, Math.abs(minValue) * 0.0005, 1);

    if (mode === "zero") {
      return {
        ...result,
        priceRange: {
          minValue: 0,
          maxValue: Math.max(maxValue, span) * 1.04,
        },
      };
    }

    const pad = mode === "padded" ? span * 0.12 : span * 0.04;
    return {
      ...result,
      priceRange: {
        minValue: minValue - pad,
        maxValue: maxValue + pad,
      },
    };
  };
}

/** Synthetic Robinhood-like sample for settings preview. */
export function buildPreviewEquityPoints(
  resolution: string,
  range: EquityRange,
  startingCash = 10_000,
): EquityPoint[] {
  const stepMs =
    resolution === "15m"
      ? 15 * 60_000
      : resolution === "6h"
        ? 6 * 60 * 60_000
        : resolution === "1d"
          ? 24 * 60 * 60_000
          : 60 * 60_000;

  const now = Date.now();
  const cutoff = rangeCutoff(range, now) ?? now - 14 * 24 * 60 * 60_000;
  const points: EquityPoint[] = [];
  let equity = startingCash;

  for (let t = cutoff; t <= now; t += stepMs) {
    const wave =
      Math.sin((t - cutoff) / (stepMs * 9)) * 42 +
      Math.sin((t - cutoff) / (stepMs * 3.2)) * 18;
    const drift = ((t - cutoff) / (now - cutoff || 1)) * 160;
    equity = startingCash + drift + wave;
    points.push({
      t: new Date(t).toISOString(),
      equity: Math.round(equity * 100) / 100,
      kind: "marked",
    });
  }

  return points;
}

export default function EquityCurveChart({
  points,
  startingCash,
  className,
  previewYAxis,
  previewRange,
  hideToolbar = false,
  emptyMessage,
}: EquityCurveChartProps) {
  const {
    equityYAxis: settingsYAxis,
    equityDefaultRange: settingsDefaultRange,
    clockFormat,
  } = useSettings();

  const yAxisMode = previewYAxis ?? settingsYAxis;
  const initialRange = previewRange ?? settingsDefaultRange;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const spanRef = useRef(1);
  const clockFormatRef = useRef(clockFormat);
  const [range, setRange] = useState<EquityRange>(initialRange);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ time: string; equity: number } | null>(
    null,
  );

  useEffect(() => {
    clockFormatRef.current = clockFormat;
  }, [clockFormat]);

  useEffect(() => {
    if (previewRange) {
      setRange(previewRange);
      return;
    }
    setRange(settingsDefaultRange);
  }, [previewRange, settingsDefaultRange]);

  const seriesData = useMemo(() => toSeriesData(points, range), [points, range]);

  const stats = useMemo(() => {
    if (seriesData.length === 0) {
      return null;
    }
    const start = seriesData[0].value;
    const end = seriesData[seriesData.length - 1].value;
    const change = end - start;
    const changePct = start === 0 ? null : (change / start) * 100;
    const vsStart = end - startingCash;
    const vsStartPct =
      startingCash === 0 ? null : (vsStart / startingCash) * 100;
    const high = Math.max(...seriesData.map((p) => p.value));
    const low = Math.min(...seriesData.map((p) => p.value));
    const span = Math.max(high - low, 1);

    return { start, end, change, changePct, vsStart, vsStartPct, high, low, span };
  }, [seriesData, startingCash]);

  useEffect(() => {
    spanRef.current = stats?.span ?? 1;
  }, [stats?.span]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#64748b",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#e2e8f0" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: { top: 0.08, bottom: 0.06 },
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        horzLine: {
          color: "#94a3b8",
          labelBackgroundColor: "#334155",
        },
        vertLine: {
          color: "#94a3b8",
          labelBackgroundColor: "#334155",
        },
      },
      localization: {
        priceFormatter: (value: number) =>
          formatAxisPrice(value, spanRef.current),
        timeFormatter: (time: UTCTimestamp) =>
          formatCrosshairTime(time, clockFormatRef.current),
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#15803d",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#cbd5e1",
      priceLineWidth: 1,
      priceFormat: {
        type: "custom",
        formatter: (value: number) => formatAxisPrice(value, spanRef.current),
        minMove: 0.01,
      },
      autoscaleInfoProvider: makeAutoscaleProvider(yAxisMode),
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setHover(null);
        return;
      }
      const point = param.seriesData.get(series) as
        | { value?: number }
        | undefined;
      if (point?.value == null) {
        setHover(null);
        return;
      }
      setHover({
        time: formatCrosshairTime(
          param.time as UTCTimestamp,
          clockFormatRef.current,
        ),
        equity: point.value,
      });
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setReady(false);
    };
  }, [yAxisMode]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    chart.applyOptions({
      localization: {
        priceFormatter: (value: number) =>
          formatAxisPrice(value, spanRef.current),
        timeFormatter: (time: UTCTimestamp) =>
          formatCrosshairTime(time, clockFormat),
      },
    });
  }, [clockFormat]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!ready || !series || !chart) {
      return;
    }

    series.setData(seriesData);
    setHover(null);

    if (seriesData.length === 0) {
      return;
    }

    const positive = (stats?.change ?? 0) >= 0;
    series.applyOptions({
      color: positive ? "#15803d" : "#b91c1c",
      autoscaleInfoProvider: makeAutoscaleProvider(yAxisMode),
    });

    chart.timeScale().fitContent();
  }, [ready, seriesData, stats?.change, yAxisMode]);

  if (points.length < 2) {
    return (
      <div className={`${styles.wrap} ${className ?? ""}`}>
        <p className={styles.empty}>
          {emptyMessage ??
            "Not enough history for a curve yet. Place a trade to start tracking portfolio value over time."}
        </p>
      </div>
    );
  }

  const displayEquity = hover?.equity ?? stats?.end ?? null;
  const displayTime = hover?.time ?? "Latest";

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      {!hideToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.readout}>
            <span className={styles.legendSeries}>
              <span
                className={styles.legendSwatch}
                style={{
                  background:
                    (stats?.change ?? 0) >= 0 ? "#15803d" : "#b91c1c",
                }}
              />
              Portfolio value
            </span>
            <span className={styles.readoutLabel}>{displayTime}</span>
            <strong className={styles.readoutValue}>
              {displayEquity == null ? "—" : formatMoney(displayEquity)}
            </strong>
            {stats && !hover && (
              <span
                className={
                  stats.change >= 0
                    ? styles.changePositive
                    : styles.changeNegative
                }
              >
                {stats.change >= 0 ? "+" : ""}
                {formatMoney(stats.change)}
                {stats.changePct == null
                  ? ""
                  : ` (${formatPct(stats.changePct)})`}
              </span>
            )}
          </div>
          <div className={styles.rangeToggle} role="group" aria-label="Timespan">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  range === item.id
                    ? `${styles.rangeButton} ${styles.rangeButtonActive}`
                    : styles.rangeButton
                }
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={hideToolbar ? styles.chartCompact : styles.chart}
        ref={containerRef}
      />

      {!hideToolbar && stats && (
        <div className={styles.metaGrid}>
          <div>
            <span>Period start</span>
            <strong>{formatMoney(stats.start)}</strong>
          </div>
          <div>
            <span>High</span>
            <strong>{formatMoney(stats.high)}</strong>
          </div>
          <div>
            <span>Low</span>
            <strong>{formatMoney(stats.low)}</strong>
          </div>
          <div>
            <span>vs starting cash</span>
            <strong
              className={
                stats.vsStart >= 0
                  ? styles.changePositive
                  : styles.changeNegative
              }
            >
              {stats.vsStartPct == null
                ? formatMoney(stats.vsStart)
                : `${stats.vsStart >= 0 ? "+" : ""}${formatMoney(stats.vsStart)} (${formatPct(stats.vsStartPct)})`}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
