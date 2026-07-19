import type { PreferredExchange } from "../../types/settings.js";
import type { StrategyTimeframe } from "../../types/strategy.js";
import { AppError } from "../../types/api.js";

/**
 * Map strategy timeframes to exchange candle intervals.
 * Coinbase has no 4h; Gemini has no 4h — both use 6h as nearest.
 */
export function resolveBacktestInterval(
  timeframe: StrategyTimeframe,
  exchange: PreferredExchange,
): { interval: string; note?: string } {
  if (timeframe === "4h") {
    return {
      interval: "6h",
      note: "4h is not supported by the exchange; using 6h candles",
    };
  }

  if (exchange === "coinbase") {
    const supported = new Set(["15m", "1h", "6h", "1d"]);
    // Coinbase public candles used in-app: 15m, 1h, 6h, 1d
    // Map finer strategy TFs up to nearest supported.
    if (timeframe === "1m" || timeframe === "5m") {
      return {
        interval: "15m",
        note: `${timeframe} is not available on Coinbase here; using 15m candles`,
      };
    }
    if (!supported.has(timeframe) && timeframe !== "15m") {
      throw new AppError(
        `Unsupported timeframe for Coinbase: ${timeframe}`,
        400,
        "INVALID_TIMEFRAME",
      );
    }
    return { interval: timeframe === "15m" ? "15m" : timeframe };
  }

  // Gemini supports 1m, 5m, 15m, 1h, 6h, 1d
  const geminiSupported = new Set(["1m", "5m", "15m", "1h", "6h", "1d"]);
  if (!geminiSupported.has(timeframe)) {
    throw new AppError(
      `Unsupported timeframe for Gemini: ${timeframe}`,
      400,
      "INVALID_TIMEFRAME",
    );
  }
  return { interval: timeframe };
}

export const BACKTEST_RANGES = ["7d", "30d", "90d", "max"] as const;
export type BacktestRange = (typeof BACKTEST_RANGES)[number];

const RANGE_MS: Record<Exclude<BacktestRange, "max">, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function filterBarsByRange<T extends { time: number }>(
  bars: T[],
  range: BacktestRange,
): T[] {
  if (range === "max" || bars.length === 0) return bars;
  const cutoffMs = Date.now() - RANGE_MS[range];
  const cutoffSec = cutoffMs / 1000;
  const filtered = bars.filter((bar) => bar.time >= cutoffSec);
  return filtered.length >= 2 ? filtered : bars.slice(-Math.min(bars.length, 50));
}
