import type { PreferredExchange } from "./settings.js";
import type { StrategyTimeframe } from "./strategy.js";

export type StrategyRunStatus = "running" | "stopped";

/** Derived from heartbeat freshness while status is running. */
export type StrategyRunPresence = "active" | "idle" | "stopped";

export interface StrategyRunRecord {
  id: string;
  userId: string;
  portfolioId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  status: StrategyRunStatus;
  lastProcessedBarTime: Date | null;
  lastHeartbeatAt: Date | null;
  lastError: string | null;
  logs: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyRunView {
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
