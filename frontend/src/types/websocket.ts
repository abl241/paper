export interface TickerUpdate {
  symbol: string;
  bid: number;
  ask: number;
  last?: number;
  timestamp: string;
}

export interface TradeUpdate {
  symbol: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  timestamp: string;
}

export type ServerMessage =
  | { type: "connected" }
  | { type: "subscribed"; symbol: string }
  | { type: "unsubscribed"; symbol: string }
  | { type: "ticker"; data: TickerUpdate }
  | { type: "trade"; data: TradeUpdate }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe"; symbol: string };

export type ConnectionState = "connecting" | "connected" | "disconnected";
