import type {
  BacktestEquityPoint,
  BacktestRange,
  BacktestStats,
  BacktestStatus,
  BacktestTrade,
  PreferredExchange,
  StrategyTimeframe,
} from "@paper/shared";

export type {
  BacktestDetail,
  BacktestRange,
  BacktestStatus,
  BacktestSummary,
  CreateBacktestInput,
} from "@paper/shared";

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
