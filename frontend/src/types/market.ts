export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: string;
}

export interface MarketSummary {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  change24h?: number;
  timestamp: string;
}

export interface MarketSummariesResponse {
  items: MarketSummary[];
  total: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: string;
}

export interface MarketTrade {
  symbol: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  timestamp: string;
}

export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

export interface ApiResponse<T> {
  data: T;
}
