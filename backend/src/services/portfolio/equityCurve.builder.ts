import type { Candle } from "../../types/market.js";
import type { EquityPoint, Trade } from "../../types/portfolio.js";
import type { EquityResolution } from "../../types/settings.js";
import { roundAmount, roundUsd } from "../../utils/decimal.js";
import { marketService } from "../market/market.service.js";

const MAX_POINTS = 480;

const RESOLUTION_MS: Record<EquityResolution, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

interface BuildMarkedEquityCurveInput {
  startingCash: number;
  createdAt: Date;
  trades: Trade[];
  exchange: string;
  resolution: EquityResolution;
  currentEquity: number;
}

function priceAtOrBefore(
  candles: Candle[],
  timeMs: number,
): number | null {
  let lo = 0;
  let hi = candles.length - 1;
  let best: number | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ts = candles[mid].timestamp.getTime();
    if (ts <= timeMs) {
      best = candles[mid].close;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

function applyTrade(
  cash: number,
  holdings: Map<string, number>,
  lastPrice: Map<string, number>,
  trade: Trade,
): number {
  const notional = trade.quantity * trade.executionPrice;
  lastPrice.set(trade.symbol, trade.executionPrice);

  if (trade.side === "buy") {
    holdings.set(
      trade.symbol,
      roundAmount((holdings.get(trade.symbol) ?? 0) + trade.quantity),
    );
    return roundUsd(cash - notional);
  }

  holdings.set(
    trade.symbol,
    roundAmount((holdings.get(trade.symbol) ?? 0) - trade.quantity),
  );
  if ((holdings.get(trade.symbol) ?? 0) <= 1e-12) {
    holdings.delete(trade.symbol);
  }
  return roundUsd(cash + notional);
}

function markEquity(
  cash: number,
  holdings: Map<string, number>,
  candleMap: Map<string, Candle[]>,
  lastPrice: Map<string, number>,
  timeMs: number,
): number {
  let equity = cash;
  for (const [symbol, qty] of holdings) {
    if (qty <= 0) {
      continue;
    }
    const candles = candleMap.get(symbol) ?? [];
    const price =
      priceAtOrBefore(candles, timeMs) ?? lastPrice.get(symbol) ?? null;
    if (price != null) {
      equity += qty * price;
      lastPrice.set(symbol, price);
    }
  }
  return roundUsd(equity);
}

function buildSampleTimes(
  startMs: number,
  endMs: number,
  stepMs: number,
  tradeTimes: number[],
): number[] {
  const times = new Set<number>();
  times.add(startMs);
  times.add(endMs);

  for (const t of tradeTimes) {
    if (t >= startMs && t <= endMs) {
      times.add(t);
    }
  }

  const alignedStart = Math.ceil(startMs / stepMs) * stepMs;
  for (let t = alignedStart; t < endMs; t += stepMs) {
    times.add(t);
  }

  return [...times].sort((a, b) => a - b);
}

function downsample(times: number[], maxPoints: number): number[] {
  if (times.length <= maxPoints) {
    return times;
  }

  const kept = new Set<number>();
  kept.add(times[0]);
  kept.add(times[times.length - 1]);

  const stride = (times.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    kept.add(times[Math.round(i * stride)]);
  }

  return [...kept].sort((a, b) => a - b);
}

/**
 * Rebuild portfolio value over time (cash + marked positions), sampled on a
 * candle grid — closer to a Robinhood home-page portfolio chart than a
 * cash-after-fill step series.
 */
export async function buildMarkedEquityCurve(
  input: BuildMarkedEquityCurveInput,
): Promise<EquityPoint[]> {
  const {
    startingCash,
    createdAt,
    trades,
    exchange,
    resolution,
    currentEquity,
  } = input;

  const startMs = createdAt.getTime();
  const endMs = Date.now();
  const stepMs = RESOLUTION_MS[resolution];

  const symbols = [...new Set(trades.map((trade) => trade.symbol))];
  const candleMap = new Map<string, Candle[]>();

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const candles = await marketService.getCandles(
          symbol,
          resolution,
          exchange,
        );
        candleMap.set(
          symbol,
          [...candles].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
          ),
        );
      } catch {
        candleMap.set(symbol, []);
      }
    }),
  );

  const tradeTimes = trades.map((trade) => trade.executedAt.getTime());
  let sampleTimes = buildSampleTimes(startMs, endMs, stepMs, tradeTimes);
  sampleTimes = downsample(sampleTimes, MAX_POINTS);

  let cash = startingCash;
  const holdings = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  let tradeIndex = 0;

  const curve: EquityPoint[] = [];

  for (const timeMs of sampleTimes) {
    while (
      tradeIndex < trades.length &&
      trades[tradeIndex].executedAt.getTime() <= timeMs
    ) {
      cash = applyTrade(cash, holdings, lastPrice, trades[tradeIndex]);
      tradeIndex += 1;
    }

    const equity = markEquity(cash, holdings, candleMap, lastPrice, timeMs);
    curve.push({
      t: new Date(timeMs).toISOString(),
      equity,
      kind: "marked",
    });
  }

  if (curve.length === 0) {
    return [
      {
        t: createdAt.toISOString(),
        equity: startingCash,
        kind: "marked",
      },
      {
        t: new Date().toISOString(),
        equity: currentEquity,
        kind: "marked",
      },
    ];
  }

  // Snap the final point to live marked equity so the chart matches the summary.
  curve[curve.length - 1] = {
    t: new Date().toISOString(),
    equity: currentEquity,
    kind: "marked",
  };

  return curve;
}
