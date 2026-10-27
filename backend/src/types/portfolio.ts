import type {
  PortfolioAllocation,
  PortfolioSummary,
  PreferredExchange,
  TradeSourceFilter,
} from "@paper/shared";

export type {
  CreatePortfolioInput,
  EquityPoint,
  FundsInput,
  PerformanceStats,
  PortfolioAllocation,
  PortfolioListItem,
  PortfolioSummary,
  PreferredExchange,
  TradeSourceFilter,
  UpdatePortfolioInput,
} from "@paper/shared";

export interface PortfolioRecord {
  id: string;
  userId: string;
  name: string;
  startingCash: number;
  cashBalance: number;
  exchange: PreferredExchange | null;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionWithMetrics extends Position {
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  allocationPct: number | null;
}

export interface Trade {
  id: string;
  portfolioId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  executionPrice: number;
  realizedPnL: number | null;
  executedAt: Date;
  /** Set when the fill came from a live paper strategy run. */
  strategyRunId: string | null;
}

export interface PortfolioDetail {
  portfolio: PortfolioRecord;
  cashBalance: number;
  positions: PositionWithMetrics[];
  summary: PortfolioSummary;
  allocation: PortfolioAllocation[];
}

export interface CashLedgerEntry {
  id: string;
  portfolioId: string;
  type: "deposit" | "withdraw" | "reset";
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Date;
}

export interface TradeFilters {
  symbol?: string;
  side?: "buy" | "sell";
  from?: Date;
  to?: Date;
  source?: TradeSourceFilter;
  strategyRunId?: string;
}

