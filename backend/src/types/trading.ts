import type { Trade } from "./portfolio.js";

export interface ExecuteOrderInput {
  symbol: string;
  quantity: number;
  /** When set, the fill is attributed to this live strategy run. */
  strategyRunId?: string;
  /**
   * Optional fill timestamp (e.g. strategy bar open). Defaults to NOW() in DB.
   * Used so chart markers align to the candle that produced the signal.
   */
  executedAt?: Date;
}

/** Paper fill at an explicit price (catch-up / historical bar open). */
export interface ExecuteOrderAtPriceInput extends ExecuteOrderInput {
  price: number;
}

export interface TradeExecutionResult {
  trade: Trade;
  cashBalance: number;
}
