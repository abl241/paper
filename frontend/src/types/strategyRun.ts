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
