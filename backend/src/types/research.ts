import type { PreferredExchange } from "./settings.js";
import type { StrategyTimeframe } from "./strategy.js";
import type {
  BacktestEquityPoint,
  BacktestStats,
  BacktestTrade,
} from "../services/research/backtest.engine.js";

export type BacktestStatus = "completed" | "failed";

export type BacktestRange = "7d" | "30d" | "90d" | "max";

export interface BacktestRecord {
  id: string;
  userId: string;
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
  createdAt: Date;
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
