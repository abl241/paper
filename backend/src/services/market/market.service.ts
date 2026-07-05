import type { Candle, MarketTrade, OrderBook, Ticker } from "../../types/market.js";
import { getExchange } from "../exchanges/index.js";
import type { Exchange } from "../exchanges/types.js";

export class MarketService {
  constructor(private readonly exchange: Exchange) {}

  getExchangeName(): string {
    return this.exchange.name;
  }

  listSymbols(): Promise<string[]> {
    return this.exchange.listSymbols();
  }

  getTicker(symbol: string): Promise<Ticker> {
    return this.exchange.getTicker(symbol);
  }

  getOrderBook(symbol: string): Promise<OrderBook> {
    return this.exchange.getOrderBook(symbol);
  }

  getTrades(symbol: string): Promise<MarketTrade[]> {
    return this.exchange.getTrades(symbol);
  }

  getCandles(symbol: string, interval: string): Promise<Candle[]> {
    return this.exchange.getCandles(symbol, interval);
  }
}

export const marketService = new MarketService(getExchange());
