export type PreferredExchange = "gemini" | "coinbase";

export interface PortfolioRecord {
  id: string;
  userId: string;
  name: string;
  startingCash: number;
  cashBalance: number;
  exchange: PreferredExchange | null;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface PositionWithMetrics {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  createdAt: string;
  updatedAt: string;
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
  executedAt: string;
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

export interface ApiResponse<T> {
  data: T;
}
