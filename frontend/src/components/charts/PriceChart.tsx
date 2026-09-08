import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useSettings } from "../../contexts/SettingsContext";
import type { Candle } from "../../types/market";
import type { ChartRange } from "../../types/settings";
import { rangeCutoffMs } from "../../types/settings";
import { formatChartDateTime } from "../../utils/datetime";
import { formatPrice } from "../../utils/format";
import styles from "./PriceChart.module.css";

export type MarketChartMode = "candle" | "line";

export interface PriceChartMarker {
  time: string;
  side: "buy" | "sell";
  price?: number;
  label?: string;
}

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  range?: ChartRange;
  mode?: MarketChartMode;
  markers?: PriceChartMarker[];
  /** Chart plot height in px. Default 360. */
  height?: number;
  emptyMessage?: string;
  className?: string;
}

interface CandleBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface LinePoint {
  time: UTCTimestamp;
  value: number;
}

interface LegendState {
  time: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
}

function parseTimeSec(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    // Heuristic: values in ms are >> typical unix seconds.
    return value > 1_000_000_000_000
      ? Math.floor(value / 1000)
      : Math.floor(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return numeric > 1_000_000_000_000
      ? Math.floor(numeric / 1000)
      : Math.floor(numeric);
  }

  const ms = new Date(trimmed).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.floor(ms / 1000);
}

function toCandleData(candles: Candle[]): CandleBar[] {
  const byTime = new Map<number, CandleBar>();

  for (const candle of candles) {
    const time = parseTimeSec(candle.timestamp);
    if (time == null) {
      continue;
    }
    byTime.set(time, {
      time: time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function toLineData(bars: CandleBar[]): LinePoint[] {
  return bars.map((bar) => ({ time: bar.time, value: bar.close }));
}

function filterBarsForRange(bars: CandleBar[], range: ChartRange): CandleBar[] {
  const cutoff = rangeCutoffMs(range);
  if (cutoff === null) {
    return bars;
  }
  const cutoffSec = Math.floor(cutoff / 1000);
  const inside = bars.filter((bar) => bar.time >= cutoffSec);
  if (inside.length > 0) {
    return inside;
  }
  return bars.slice(-2);
}

/**
 * Snap a fill onto a candle using History fields (`executedAt` + optional price).
 *
 * Prefer the last bar at or before the trade time. When a price is present and
 * that time-based bar is a poor match (common for catch-up fills stamped with
 * wall-clock NOW), search nearby bars for an open/close match so markers land
 * on the candle that actually produced the fill.
 */
function snapTimeToBars(
  timeSec: number,
  bars: CandleBar[],
  price?: number,
): UTCTimestamp | null {
  if (bars.length === 0) {
    return null;
  }

  let timeIndex: number;
  if (timeSec <= bars[0].time) {
    timeIndex = 0;
  } else if (timeSec >= bars[bars.length - 1].time) {
    timeIndex = bars.length - 1;
  } else {
    let lo = 0;
    let hi = bars.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].time <= timeSec) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    timeIndex = Math.max(0, hi);
  }

  const timeBar = bars[timeIndex];
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return timeBar.time;
  }

  const timeMatchScore = candlePriceScore(timeBar, price);
  // Tight match on the time-aligned bar — trust History's timestamp.
  if (timeMatchScore <= 0.0005) {
    return timeBar.time;
  }

  // Search the whole series for the best open/close match (catch-up fills at
  // bar open often share one wall-clock timestamp but distinct prices).
  let best = timeBar;
  let bestScore = timeMatchScore;
  for (const bar of bars) {
    const score = candlePriceScore(bar, price);
    if (score < bestScore) {
      best = bar;
      bestScore = score;
    }
  }

  // Only override the time snap when price evidence is clearly better.
  if (bestScore < timeMatchScore * 0.25 || bestScore <= 0.001) {
    return best.time;
  }

  return timeBar.time;
}

function candlePriceScore(bar: CandleBar, price: number): number {
  const openDist = Math.abs(bar.open - price) / price;
  const closeDist = Math.abs(bar.close - price) / price;
  const inRange =
    price >= Math.min(bar.low, bar.high) &&
    price <= Math.max(bar.low, bar.high);
  const rangeScore = inRange ? 0.0008 : 1;
  return Math.min(openDist, closeDist, rangeScore);
}

function toSeriesMarkers(
  markers: PriceChartMarker[],
  bars: CandleBar[],
): SeriesMarker<UTCTimestamp>[] {
  const result: SeriesMarker<UTCTimestamp>[] = [];

  for (const marker of markers) {
    const rawSec = parseTimeSec(marker.time);
    if (rawSec == null) {
      continue;
    }

    const snapped = snapTimeToBars(rawSec, bars, marker.price);
    if (snapped == null) {
      continue;
    }

    const isBuy = marker.side === "buy";
    result.push({
      time: snapped,
      position: isBuy ? "belowBar" : "aboveBar",
      color: isBuy ? "#15803d" : "#b91c1c",
      shape: isBuy ? "arrowUp" : "arrowDown",
      text: marker.label ?? (isBuy ? "B" : "S"),
    });
  }

  return result.sort((a, b) => Number(a.time) - Number(b.time));
}

export default function PriceChart({
  candles,
  range = "1W",
  mode = "candle",
  markers,
  height = 360,
  emptyMessage,
  className,
}: PriceChartProps) {
  const { clockFormat } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const barsRef = useRef<CandleBar[]>([]);
  const clockFormatRef = useRef(clockFormat);
  const [legend, setLegend] = useState<LegendState | null>(null);

  const allBars = useMemo(() => toCandleData(candles), [candles]);
  const bars = useMemo(
    () => filterBarsForRange(allBars, range),
    [allBars, range],
  );

  const seriesMarkers = useMemo(
    () => toSeriesMarkers(markers ?? [], bars),
    [markers, bars],
  );

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  useEffect(() => {
    clockFormatRef.current = clockFormat;
  }, [clockFormat]);

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
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) =>
          formatChartDateTime(time, clockFormatRef.current),
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
    });

    chartRef.current = chart;

    return () => {
      markersApiRef.current?.detach();
      markersApiRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chart.applyOptions({
      localization: {
        timeFormatter: (time: UTCTimestamp) =>
          formatChartDateTime(time, clockFormat),
      },
    });
  }, [clockFormat]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    markersApiRef.current?.detach();
    markersApiRef.current = null;

    if (candleSeriesRef.current) {
      chart.removeSeries(candleSeriesRef.current);
      candleSeriesRef.current = null;
    }
    if (lineSeriesRef.current) {
      chart.removeSeries(lineSeriesRef.current);
      lineSeriesRef.current = null;
    }

    if (mode === "candle") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#15803d",
        downColor: "#b91c1c",
        borderUpColor: "#15803d",
        borderDownColor: "#b91c1c",
        wickUpColor: "#15803d",
        wickDownColor: "#b91c1c",
      });
      candleSeriesRef.current = series;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: "#1d4ed8",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      lineSeriesRef.current = series;
    }
  }, [mode]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    const series = mode === "candle" ? candleSeries : lineSeries;
    if (!chart || !series) {
      return;
    }

    if (mode === "candle" && candleSeries) {
      candleSeries.setData(bars);
    } else if (mode === "line" && lineSeries) {
      lineSeries.setData(toLineData(bars));
    }

    if (!markersApiRef.current) {
      markersApiRef.current = createSeriesMarkers(series, seriesMarkers);
    } else {
      markersApiRef.current.setMarkers(seriesMarkers);
    }

    if (bars.length === 0) {
      setLegend(null);
      return;
    }

    const last = bars[bars.length - 1];
    setLegend({
      time: formatChartDateTime(last.time, clockFormat),
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
    });

    chart.timeScale().fitContent();
  }, [bars, mode, clockFormat, seriesMarkers]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const handler = (param: {
      time?: unknown;
      seriesData: Map<unknown, unknown>;
    }) => {
      const series = candleSeriesRef.current ?? lineSeriesRef.current;
      if (!param.time || !series) {
        const last = barsRef.current[barsRef.current.length - 1];
        if (last) {
          setLegend({
            time: formatChartDateTime(last.time, clockFormatRef.current),
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          });
        }
        return;
      }

      const point = param.seriesData.get(series) as
        | {
            open?: number;
            high?: number;
            low?: number;
            close?: number;
            value?: number;
          }
        | undefined;

      if (!point) {
        return;
      }

      if (point.close != null) {
        setLegend({
          time: formatChartDateTime(
            param.time as UTCTimestamp,
            clockFormatRef.current,
          ),
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
        });
        return;
      }

      if (point.value != null) {
        setLegend({
          time: formatChartDateTime(
            param.time as UTCTimestamp,
            clockFormatRef.current,
          ),
          close: point.value,
        });
      }
    };

    chart.subscribeCrosshairMove(handler);
    return () => {
      chart.unsubscribeCrosshairMove(handler);
    };
  }, [mode]);

  if (candles.length === 0) {
    return (
      <p className={styles.empty}>
        {emptyMessage ?? "No chart data available."}
      </p>
    );
  }

  const up =
    legend != null && legend.open != null && legend.close >= legend.open;
  const hasMarkers = (markers?.length ?? 0) > 0;

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <div className={styles.legend} aria-live="polite">
        <span className={styles.legendSeries}>
          <span
            className={styles.legendSwatch}
            style={{
              background:
                mode === "candle" ? (up ? "#15803d" : "#b91c1c") : "#1d4ed8",
            }}
          />
          {mode === "candle" ? "Candles" : "Close"}
        </span>
        {hasMarkers ? (
          <span className={styles.markerLegend}>
            <span className={styles.markerBuy}>▲ Buy</span>
            <span className={styles.markerSell}>▼ Sell</span>
          </span>
        ) : null}
        {legend && (
          <>
            <span className={styles.legendTime}>{legend.time}</span>
            {mode === "candle" && legend.open != null && (
              <>
                <span>
                  O <strong>${formatPrice(legend.open)}</strong>
                </span>
                <span>
                  H <strong>${formatPrice(legend.high ?? legend.close)}</strong>
                </span>
                <span>
                  L <strong>${formatPrice(legend.low ?? legend.close)}</strong>
                </span>
              </>
            )}
            <span>
              {mode === "candle" ? "C" : "Price"}{" "}
              <strong
                className={
                  mode === "candle" ? (up ? styles.up : styles.down) : undefined
                }
              >
                ${formatPrice(legend.close)}
              </strong>
            </span>
          </>
        )}
      </div>
      <div
        ref={containerRef}
        className={styles.chartWrap}
        style={{ height }}
      />
    </div>
  );
}
