import type { Trade } from "./portfolio.js";

export interface ExecuteOrderInput {
  symbol: string;
  quantity: number;
}

export interface TradeExecutionResult {
  trade: Trade;
  cashBalance: number;
}
