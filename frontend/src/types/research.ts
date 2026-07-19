export type PreferredExchange = "gemini" | "coinbase";

export type BacktestRange = "7d" | "30d" | "90d" | "max";

export type BacktestStatus = "completed" | "failed";

export type StrategyTimeframe =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1d";

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

export interface BacktestSummary {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  rangeLabel: BacktestRange;
  status: BacktestStatus;
  stats: BacktestStats;
  createdAt: string;
}

export interface BacktestDetail {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  rangeLabel: BacktestRange;
  startingCapital: number;
  feeBps: number;
  status: BacktestStatus;
  stats: BacktestStats;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  logs: string[];
  notes: string[];
  error: string | null;
  createdAt: string;
}

export interface CreateBacktestInput {
  strategyId: string;
  symbol?: string;
  range?: BacktestRange;
  feeBps?: number;
  exchange?: PreferredExchange | null;
}

export interface ApiResponse<T> {
  data: T;
}

export const BACKTEST_RANGES: { id: BacktestRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "max", label: "Max available" },
];
