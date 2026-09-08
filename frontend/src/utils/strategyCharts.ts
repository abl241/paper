import type { PriceChartMarker } from "../components/charts/PriceChart";
import type { Candle } from "../types/market";
import type { EquityPoint } from "../types/portfolio";
import type { BacktestRange } from "../types/research";
import type { PreferredExchange } from "../types/settings";
import type { StrategyTimeframe } from "../types/strategy";
import type { StrategyRunTrade } from "../types/strategyRun";

/**
 * Map strategy timeframes to exchange candle intervals (mirrors backend
 * resolveBacktestInterval for client-side chart fetches).
 */
export function candleIntervalForStrategyTimeframe(
  timeframe: StrategyTimeframe,
  exchange: PreferredExchange | null = null,
): string {
  if (timeframe === "4h") {
    return "6h";
  }

  if (
    exchange === "coinbase" &&
    (timeframe === "1m" || timeframe === "5m")
  ) {
    return "15m";
  }

  return timeframe;
}

export function tradesToPriceMarkers(
  trades: Array<{
    time: string;
    side: "buy" | "sell";
    price?: number;
  }>,
): PriceChartMarker[] {
  return trades.map((trade) => ({
    time: trade.time,
    side: trade.side,
    price: trade.price,
    label: trade.side === "buy" ? "B" : "S",
  }));
}

export function buildCumulativeRealizedPoints(
  trades: StrategyRunTrade[],
  startedAt: string,
): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) =>
      new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  let cumulative = 0;
  const points: EquityPoint[] = [
    { t: startedAt, equity: 0, kind: "marked" },
  ];

  for (const trade of sorted) {
    if (trade.realizedPnL != null) {
      cumulative += trade.realizedPnL;
    }
    points.push({
      t: trade.executedAt,
      equity: Math.round(cumulative * 100) / 100,
      kind: "marked",
    });
  }

  if (points.length < 2) {
    points.push({
      t: new Date().toISOString(),
      equity: cumulative,
      kind: "marked",
    });
  }

  return points;
}

const BACKTEST_RANGE_MS: Record<Exclude<BacktestRange, "max">, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function filterCandlesByBacktestRange(
  candles: Candle[],
  range: BacktestRange,
): Candle[] {
  if (range === "max" || candles.length === 0) {
    return candles;
  }

  const cutoff = Date.now() - BACKTEST_RANGE_MS[range];
  const filtered = candles.filter(
    (candle) => new Date(candle.timestamp).getTime() >= cutoff,
  );

  if (filtered.length >= 2) {
    return filtered;
  }

  return candles.slice(-Math.min(candles.length, 50));
}
