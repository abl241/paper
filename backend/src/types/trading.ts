import type { Trade } from "./portfolio.js";

export interface ExecuteOrderInput {
  symbol: string;
  quantity: number;
  /** When set, the fill is attributed to this live strategy run. */
  strategyRunId?: string;
}

/** Paper fill at an explicit price (catch-up / historical bar open). */
export interface ExecuteOrderAtPriceInput extends ExecuteOrderInput {
  price: number;
}

export interface TradeExecutionResult {
  trade: Trade;
  cashBalance: number;
}
