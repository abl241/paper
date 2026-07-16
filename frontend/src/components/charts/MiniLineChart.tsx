import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getCandles } from "../../api/markets";
import { useSettings } from "../../contexts/SettingsContext";
import styles from "./MiniLineChart.module.css";

interface MiniLineChartProps {
  symbol: string;
}

const MAX_POINTS = 48;

export default function MiniLineChart({ symbol }: MiniLineChartProps) {
  const { exchange } = useSettings();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "transparent",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        horzLine: { visible: false },
        vertLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#1d4ed8",
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setReady(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !seriesRef.current || !chartRef.current) {
      return;
    }

    let cancelled = false;
    setFailed(false);

    getCandles(symbol, "1h")
      .then((candles) => {
        if (cancelled || !seriesRef.current || !chartRef.current) {
          return;
        }

        const points = candles
          .slice(-MAX_POINTS)
          .map((candle) => ({
            time: Math.floor(new Date(candle.timestamp).getTime() / 1000) as UTCTimestamp,
            value: candle.close,
          }))
          .sort((a, b) => a.time - b.time);

        if (points.length < 2) {
          setFailed(true);
          return;
        }

        const first = points[0].value;
        const last = points[points.length - 1].value;
        seriesRef.current.applyOptions({
          color: last >= first ? "#15803d" : "#b91c1c",
        });
        seriesRef.current.setData(points);
        chartRef.current.timeScale().fitContent();
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, ready, exchange]);

  if (failed) {
    return <div className={styles.fallback} aria-hidden="true" />;
  }

  return <div ref={containerRef} className={styles.chart} />;
}
