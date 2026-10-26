import { roundAmount } from "../../utils/decimal.js";
import type { OrderIntent } from "./sandbox.js";

/**
 * Order sizing and position math shared by backtests and live paper runs, so the same
 * strategy sizes orders the same way in both.
 */

/** Quantity for a buy intent: explicit quantity, else a fraction of equity or cash, else 10% of cash. */
export function resolveBuyQty(
  intent: OrderIntent,
  cash: number,
  equity: number,
  price: number,
): number {
  if (!(price > 0)) return 0;
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

export interface HeldPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
}

/**
 * Cash plus holdings: the strategy's symbol marked at `price`, other symbols at cost
 * (no live quotes for them during evaluation).
 */
export function markEquity(
  cash: number,
  positions: HeldPosition[],
  symbol: string,
  price: number,
): number {
  return positions.reduce(
    (sum, position) =>
      sum +
      position.quantity * (position.symbol === symbol ? price : position.averageCost),
    cash,
  );
}

export interface RunFill {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  executionPrice: number;
}

/**
 * Net size and average cost of a strategy run's own fills, in chronological order.
 * Buys average in; sells reduce size at unchanged cost; a flat position resets cost.
 */
export function runPosition(
  fillsOldestFirst: RunFill[],
  symbol: string,
): { quantity: number; averageCost: number } {
  let quantity = 0;
  let averageCost = 0;
  for (const fill of fillsOldestFirst) {
    if (fill.symbol !== symbol) continue;
    if (fill.side === "buy") {
      const next = quantity + fill.quantity;
      averageCost = next > 0 ? (averageCost * quantity + fill.executionPrice * fill.quantity) / next : 0;
      quantity = next;
    } else {
      quantity = Math.max(0, roundAmount(quantity - fill.quantity));
      if (quantity === 0) averageCost = 0;
    }
  }
  return { quantity: roundAmount(quantity), averageCost: roundAmount(averageCost) };
}
