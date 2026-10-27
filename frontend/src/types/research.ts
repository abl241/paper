import type { BacktestRange } from "@paper/shared";

export type {
  ApiResponse,
  BacktestDetail,
  BacktestEquityPoint,
  BacktestRange,
  BacktestStats,
  BacktestStatus,
  BacktestSummary,
  BacktestTrade,
  CreateBacktestInput,
  PreferredExchange,
  StrategyTimeframe,
} from "@paper/shared";

export const BACKTEST_RANGES: { id: BacktestRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "max", label: "Max available" },
];
