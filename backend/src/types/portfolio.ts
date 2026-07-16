import type { PreferredExchange } from "./settings.js";

export type { PreferredExchange };
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
}

export interface PortfolioSummary {
  totalEquity: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalReturnPct: number;
  cashAllocationPct: number;
}

export interface PortfolioAllocation {
  symbol: string;
  value: number;
  pct: number;
}

export interface PortfolioDetail {
  portfolio: PortfolioRecord;
  cashBalance: number;
  positions: PositionWithMetrics[];
  summary: PortfolioSummary;
  allocation: PortfolioAllocation[];
}

export interface PortfolioListItem {
  id: string;
  name: string;
  cashBalance: number;
  startingCash: number;
  exchange: PreferredExchange | null;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioInput {
  name: string;
  startingCash?: number;
  exchange?: PreferredExchange | null;
}

export interface UpdatePortfolioInput {
  name?: string;
  exchange?: PreferredExchange | null;
}

export interface FundsInput {
  type: "deposit" | "withdraw";
  amount: number;
  note?: string;
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
}

export interface EquityPoint {
  t: string;
  equity: number;
  kind: "cash_path" | "marked";
}

export interface PerformanceStats {
  totalEquity: number;
  startingCash: number;
  totalReturnPct: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  tradeCount: number;
  closedTradeCount: number;
  equityCurve: EquityPoint[];
}
