import type { Candle, MarketTrade, OrderBook, Ticker } from "../../types/market.js";

export interface CandleFetchOptions {
  /** When true, fetch as much history as the venue provides (Focus "All"). */
  fullHistory?: boolean;
}

export interface Exchange {
  readonly name: string;
  listSymbols(): Promise<string[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getOrderBook(symbol: string): Promise<OrderBook>;
  getTrades(symbol: string): Promise<MarketTrade[]>;
  getCandles(
    symbol: string,
    interval: string,
    options?: CandleFetchOptions,
  ): Promise<Candle[]>;
}
