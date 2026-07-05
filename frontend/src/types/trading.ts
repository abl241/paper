import type { Trade } from "./portfolio";

export interface ExecuteOrderInput {
  symbol: string;
  quantity: number;
}

export interface TradeExecutionResult {
  trade: Trade;
  cashBalance: number;
}

export interface ApiResponse<T> {
  data: T;
}
