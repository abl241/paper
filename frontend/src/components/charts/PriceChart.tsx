import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
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

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  range?: ChartRange;
  mode?: MarketChartMode;
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

function toCandleData(candles: Candle[]): CandleBar[] {
  const byTime = new Map<number, CandleBar>();

  for (const candle of candles) {
    const time = Math.floor(
      new Date(candle.timestamp).getTime() / 1000,
    ) as UTCTimestamp;
    byTime.set(time, {
      time,
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

export default function PriceChart({
  candles,
  range = "1W",
  mode = "candle",
}: PriceChartProps) {
  const { clockFormat } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const barsRef = useRef<CandleBar[]>([]);
  const clockFormatRef = useRef(clockFormat);
  const [legend, setLegend] = useState<LegendState | null>(null);

  const allBars = useMemo(() => toCandleData(candles), [candles]);
  const bars = useMemo(
    () => filterBarsForRange(allBars, range),
    [allBars, range],
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
    if (!chart) {
      return;
    }

    if (mode === "candle" && candleSeries) {
      candleSeries.setData(bars);
    } else if (mode === "line" && lineSeries) {
      lineSeries.setData(toLineData(bars));
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
  }, [bars, mode, clockFormat]);

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
    return <p className={styles.empty}>No chart data available.</p>;
  }

  const up =
    legend != null && legend.open != null && legend.close >= legend.open;

  return (
    <div className={styles.wrap}>
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
      <div ref={containerRef} className={styles.chartWrap} />
    </div>
  );
}
