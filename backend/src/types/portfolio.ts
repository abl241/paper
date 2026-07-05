export interface CashAccount {
  userId: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  userId: string;
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
}

export interface Trade {
  id: string;
  userId: string;
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
}

export interface Portfolio {
  cashBalance: number;
  positions: PositionWithMetrics[];
  trades: Trade[];
  summary: PortfolioSummary;
}
