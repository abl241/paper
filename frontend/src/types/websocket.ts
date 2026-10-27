export type {
  ClientMessage,
  ServerMessage,
  TickerUpdate,
  TradeUpdate,
} from "@paper/shared";

export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "stale";
