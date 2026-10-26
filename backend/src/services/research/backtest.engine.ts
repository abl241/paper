import type {
  OrderIntent,
  SandboxedStrategy,
  StrategyBar,
  StrategyParams,
} from "../strategy/runtime.js";
import { StrategySandboxError } from "../strategy/sandbox.js";
import { markEquity as markHoldings, resolveBuyQty } from "../strategy/sizing.js";

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
  strategy: SandboxedStrategy;
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
/** Wall-clock cap for a whole backtest, on top of the sandbox's per-bar limit. */
const BACKTEST_TIME_BUDGET_MS = 15_000;

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

  const markEquity = (price: number) =>
    markHoldings(
      cash,
      positionSize > 0 ? [{ symbol, quantity: positionSize, averageCost }] : [],
      symbol,
      price,
    );
  const startedAt = Date.now();

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (Date.now() - startedAt > BACKTEST_TIME_BUDGET_MS) {
      throw new StrategySandboxError(
        `Backtest exceeded its ${BACKTEST_TIME_BUDGET_MS / 1000}s time budget at bar ${i} of ${bars.length}`,
      );
    }

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

    const position = {
      symbol,
      size: positionSize,
      averageCost,
      unrealizedPnL,
    };

    strategy.evaluate(
      {
        symbol,
        bars,
        barCount: i + 1,
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
      },
      {
        buy(order) {
          queue.pending = { side: "buy", intent: order };
        },
        sell(order) {
          queue.pending = { side: "sell", intent: order };
        },
        log(message) {
          pushLog(message);
        },
      },
    );

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
