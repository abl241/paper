export interface GeminiTickerResponse {
  bid: string;
  ask: string;
  last: string;
  volume?: Record<string, string>;
}

export interface GeminiOrderBookEntry {
  price: string;
  amount: string;
  timestamp?: string;
}

export interface GeminiOrderBookResponse {
  bids: GeminiOrderBookEntry[];
  asks: GeminiOrderBookEntry[];
}

export interface GeminiTradeResponse {
  timestamp: number;
  timestampms?: number;
  tid: number;
  price: string;
  amount: string;
  exchange: string;
  type: "buy" | "sell";
}

export type GeminiCandleResponse = [
  number,
  string,
  string,
  string,
  string,
  string,
];
