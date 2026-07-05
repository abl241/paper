import type { Candle, MarketTrade, OrderBook, Ticker } from "../../types/market.js";

export interface Exchange {
  readonly name: string;
  listSymbols(): Promise<string[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getOrderBook(symbol: string): Promise<OrderBook>;
  getTrades(symbol: string): Promise<MarketTrade[]>;
  getCandles(symbol: string, interval: string): Promise<Candle[]>;
}
