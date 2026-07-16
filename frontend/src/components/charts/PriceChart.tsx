import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../../types/market";
import styles from "./PriceChart.module.css";

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  interval?: string;
}

/** Default visible window (seconds) so interval buttons change the view. */
const VISIBLE_SECONDS: Record<string, number> = {
  "1h": 60 * 60 * 48,
  "6h": 60 * 60 * 24 * 7,
  "1d": 60 * 60 * 24 * 30,
};

function toChartData(candles: Candle[]) {
  const byTime = new Map<
    number,
    { time: UTCTimestamp; open: number; high: number; low: number; close: number }
  >();

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

function visibleWindowSeconds(interval?: string): number {
  if (!interval) {
    return VISIBLE_SECONDS["1h"];
  }
  return VISIBLE_SECONDS[interval] ?? VISIBLE_SECONDS["1h"];
}

export default function PriceChart({ candles, interval = "1h" }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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
      crosshair: {
        horzLine: { color: "#94a3b8" },
        vertLine: { color: "#94a3b8" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#15803d",
      downColor: "#b91c1c",
      borderUpColor: "#15803d",
      borderDownColor: "#b91c1c",
      wickUpColor: "#15803d",
      wickDownColor: "#b91c1c",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) {
      return;
    }

    const data = toChartData(candles);
    series.setData(data);

    if (data.length === 0) {
      return;
    }

    const barSeconds =
      interval === "1d" ? 60 * 60 * 24 : interval === "6h" ? 60 * 60 * 6 : 60 * 60;
    const visibleBars = Math.max(
      2,
      Math.ceil(visibleWindowSeconds(interval) / barSeconds),
    );
    const from = Math.max(0, data.length - visibleBars);

    chart.timeScale().setVisibleLogicalRange({
      from: from - 0.5,
      to: data.length - 0.5,
    });
  }, [candles, interval]);

  if (candles.length === 0) {
    return <p className={styles.empty}>No chart data available.</p>;
  }

  return <div ref={containerRef} className={styles.chartWrap} />;
}
