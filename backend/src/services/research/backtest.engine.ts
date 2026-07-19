import type {
  StrategyBar,
  StrategyFn,
  StrategyParams,
  OrderIntent,
} from "../strategy/runtime.js";
import { createIndicators } from "../strategy/runtime.js";

export interface BacktestTrade {
  time: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
}

export interface BacktestEquityPoint {
  t: string;
  equity: number;
  kind: "marked";
}

export interface BacktestStats {
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRate: number;
  endingEquity: number;
  startingCapital: number;
}

export interface BacktestEngineInput {
  strategy: StrategyFn;
  params: StrategyParams;
  bars: StrategyBar[];
  symbol: string;
  startingCapital: number;
  feeBps: number;
  maxLogs?: number;
}

export interface BacktestEngineResult {
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  stats: BacktestStats;
  logs: string[];
}

const MAX_EQUITY_POINTS = 500;

function downsampleEquity(
  points: BacktestEquityPoint[],
): BacktestEquityPoint[] {
  if (points.length <= MAX_EQUITY_POINTS) return points;
  const step = Math.ceil(points.length / MAX_EQUITY_POINTS);
  const sampled: BacktestEquityPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function resolveBuyQty(
  intent: OrderIntent,
  cash: number,
  equity: number,
  price: number,
): number {
  if (intent.quantity !== undefined && Number.isFinite(intent.quantity)) {
    return Math.max(0, intent.quantity);
  }
  if (
    intent.fractionOfEquity !== undefined &&
    Number.isFinite(intent.fractionOfEquity)
  ) {
    return Math.max(0, (equity * intent.fractionOfEquity) / price);
  }
  if (
    intent.fractionOfCash !== undefined &&
    Number.isFinite(intent.fractionOfCash)
  ) {
    return Math.max(0, (cash * intent.fractionOfCash) / price);
  }
  return Math.max(0, cash / price / 10);
}

export function runBacktest(input: BacktestEngineInput): BacktestEngineResult {
  const {
    strategy,
    params,
    bars,
    symbol,
    startingCapital,
    feeBps,
    maxLogs = 200,
  } = input;

  if (bars.length < 2) {
    return {
      equityCurve: [],
      trades: [],
      stats: {
        totalReturnPct: 0,
        maxDrawdownPct: 0,
        tradeCount: 0,
        winRate: 0,
        endingEquity: startingCapital,
        startingCapital,
      },
      logs: ["Need at least 2 bars to backtest"],
    };
  }

  let cash = startingCapital;
  let positionSize = 0;
  let averageCost = 0;
  /** Boxed so TS CFA does not treat assignments inside strategy buy/sell as unreachable. */
  const queue: {
    pending: { side: "buy" | "sell"; intent: OrderIntent } | null;
  } = { pending: null };
  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestEquityPoint[] = [];
  const logs: string[] = [];
  const indicators = createIndicators();
  const feeRate = Math.max(0, feeBps) / 10_000;

  const pushLog = (message: string) => {
    if (logs.length < maxLogs) {
      logs.push(message);
    }
  };

  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  let closedWins = 0;
  let closedTrades = 0;

  const markEquity = (price: number) => cash + positionSize * price;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];

    // Fill orders queued on the previous bar at this bar's open.
    const toFill = i > 0 ? queue.pending : null;
    if (toFill) {
      queue.pending = null;
      const fillPrice = bar.open;
      if (toFill.side === "buy") {
        const equity = markEquity(fillPrice);
        const qty = resolveBuyQty(toFill.intent, cash, equity, fillPrice);
        const notional = qty * fillPrice;
        const fee = notional * feeRate;
        const total = notional + fee;
        if (qty > 0 && total <= cash) {
          const newSize = positionSize + qty;
          averageCost =
            newSize > 0
              ? (averageCost * positionSize + notional) / newSize
              : 0;
          positionSize = newSize;
          cash -= total;
          trades.push({
            time: new Date(bar.time * 1000).toISOString(),
            side: "buy",
            quantity: qty,
            price: fillPrice,
            fee,
          });
          pushLog(
            `fill buy ${qty.toFixed(6)} ${symbol} @ ${fillPrice.toFixed(2)} fee=${fee.toFixed(2)}`,
          );
        } else {
          pushLog("buy skipped — insufficient cash");
        }
      } else {
        const qty = Math.min(
          toFill.intent.quantity !== undefined &&
            Number.isFinite(toFill.intent.quantity)
            ? toFill.intent.quantity
            : positionSize,
          positionSize,
        );
        if (qty > 0) {
          const notional = qty * fillPrice;
          const fee = notional * feeRate;
          const proceeds = notional - fee;
          const costBasis = averageCost * qty;
          const pnl = proceeds - costBasis;
          cash += proceeds;
          positionSize -= qty;
          if (positionSize <= 1e-12) {
            positionSize = 0;
            averageCost = 0;
          }
          closedTrades += 1;
          if (pnl > 0) closedWins += 1;
          trades.push({
            time: new Date(bar.time * 1000).toISOString(),
            side: "sell",
            quantity: qty,
            price: fillPrice,
            fee,
          });
          pushLog(
            `fill sell ${qty.toFixed(6)} ${symbol} @ ${fillPrice.toFixed(2)} fee=${fee.toFixed(2)}`,
          );
        } else {
          pushLog("sell skipped — flat");
        }
      }
    }

    const price = bar.close;
    const equity = markEquity(price);
    const unrealizedPnL =
      positionSize > 0 ? (price - averageCost) * positionSize : 0;

    const slice = bars.slice(0, i + 1);
    const position = {
      symbol,
      size: positionSize,
      averageCost,
      unrealizedPnL,
    };

    const ctx = {
      symbol,
      bars: slice,
      price,
      position,
      cash,
      equity,
      portfolio: {
        cash,
        equity,
        positions: positionSize > 0 ? [position] : [],
      },
      params,
      buy(order: OrderIntent = {}) {
        queue.pending = { side: "buy", intent: order };
      },
      sell(order: OrderIntent = {}) {
        queue.pending = { side: "sell", intent: order };
      },
      indicator: indicators,
      log(message: string) {
        pushLog(String(message));
      },
    };

    strategy(ctx);

    const marked = markEquity(price);
    if (marked > peakEquity) peakEquity = marked;
    const dd =
      peakEquity > 0 ? ((peakEquity - marked) / peakEquity) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;

    equityCurve.push({
      t: new Date(bar.time * 1000).toISOString(),
      equity: marked,
      kind: "marked",
    });
  }

  // Drop unfilled pending at end of series (no next bar).
  if (queue.pending) {
    pushLog("pending order dropped — no next bar to fill");
  }

  const endingEquity =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : startingCapital;
  const totalReturnPct =
    startingCapital > 0
      ? ((endingEquity - startingCapital) / startingCapital) * 100
      : 0;

  return {
    equityCurve: downsampleEquity(equityCurve),
    trades,
    stats: {
      totalReturnPct,
      maxDrawdownPct,
      tradeCount: trades.length,
      winRate: closedTrades > 0 ? (closedWins / closedTrades) * 100 : 0,
      endingEquity,
      startingCapital,
    },
    logs,
  };
}
