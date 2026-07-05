export interface PositionWithMetrics {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  createdAt: string;
  updatedAt: string;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
}

export interface Trade {
  id: string;
  userId: string;
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
}

export interface Portfolio {
  cashBalance: number;
  positions: PositionWithMetrics[];
  trades: Trade[];
  summary: PortfolioSummary;
}

export interface ApiResponse<T> {
  data: T;
}
