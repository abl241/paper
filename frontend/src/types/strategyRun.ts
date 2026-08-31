export type PreferredExchange = "gemini" | "coinbase";

export type StrategyTimeframe =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1d";

export type StrategyRunStatus = "running" | "stopped";

export type StrategyRunPresence = "active" | "idle" | "stopped";

export interface StrategyRunTrade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  executionPrice: number;
  realizedPnL: number | null;
  executedAt: string;
}

export interface StrategyRunStats {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  realizedPnL: number;
  winRate: number | null;
  closedTrades: number;
}

export interface StrategyRun {
  id: string;
  portfolioId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  status: StrategyRunStatus;
  presence: StrategyRunPresence;
  lastProcessedBarTime: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  logs: string[];
  trades: StrategyRunTrade[];
  stats: StrategyRunStats;
  createdAt: string;
  updatedAt: string;
}

export interface StartStrategyRunInput {
  strategyId: string;
  symbol?: string;
}

export interface ApiResponse<T> {
  data: T;
}
