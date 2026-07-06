import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle } from "../../types/market";
import styles from "./PriceChart.module.css";

interface PriceChartProps {
  symbol: string;
  candles: Candle[];
  interval?: string;
}

interface ChartPoint {
  label: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

function formatAxisLabel(timestamp: string, interval: string): string {
  const date = new Date(timestamp);
  if (interval === "1d") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
  });
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function PriceChart({ symbol, candles, interval }: PriceChartProps) {
  const data: ChartPoint[] = candles.map((candle) => ({
    label: new Date(candle.timestamp).toISOString(),
    close: candle.close,
    high: candle.high,
    low: candle.low,
    volume: candle.volume,
  }));

  if (data.length === 0) {
    return <p className={styles.empty}>No chart data available.</p>;
  }

  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickFormatter={(value) =>
              formatAxisLabel(String(value), interval ?? "1h")
            }
            minTickGap={24}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            width={80}
            tick={{ fill: "#64748b", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => [formatPrice(value), "Close"]}
            labelFormatter={(label) =>
              new Date(String(label)).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            }
            contentStyle={{
              borderRadius: "0.375rem",
              borderColor: "#e2e8f0",
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name={`${symbol} close`}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
