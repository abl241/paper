import type { PreferredExchange, StrategyRunStatus, StrategyTimeframe } from "@paper/shared";

export type {
  StartStrategyRunInput,
  StrategyRunPresence,
  StrategyRunStats,
  StrategyRunStatus,
  StrategyRunTrade,
  StrategyRunView,
} from "@paper/shared";

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
  /** When true, sells only close size this run bought. */
  protectManualPositions: boolean;
  createdAt: Date;
  updatedAt: Date;
}
