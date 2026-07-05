export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: string;
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

export interface ApiResponse<T> {
  data: T;
}
