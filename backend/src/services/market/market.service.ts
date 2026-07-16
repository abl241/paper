import type { Candle, MarketTrade, OrderBook, Ticker } from "../../types/market.js";
import {
  getExchange,
  parseExchangeName,
  type ExchangeName,
} from "../exchanges/index.js";
import type { Exchange } from "../exchanges/types.js";

export class MarketService {
  resolveExchange(name?: string | ExchangeName): Exchange {
    return getExchange(parseExchangeName(name));
  }

  getExchangeName(name?: string | ExchangeName): string {
    return this.resolveExchange(name).name;
  }

  listSymbols(exchange?: string | ExchangeName): Promise<string[]> {
    return this.resolveExchange(exchange).listSymbols();
  }

  getTicker(symbol: string, exchange?: string | ExchangeName): Promise<Ticker> {
    return this.resolveExchange(exchange).getTicker(symbol);
  }

  getOrderBook(
    symbol: string,
    exchange?: string | ExchangeName,
  ): Promise<OrderBook> {
    return this.resolveExchange(exchange).getOrderBook(symbol);
  }

  getTrades(
    symbol: string,
    exchange?: string | ExchangeName,
  ): Promise<MarketTrade[]> {
    return this.resolveExchange(exchange).getTrades(symbol);
  }

  getCandles(
    symbol: string,
    interval: string,
    exchange?: string | ExchangeName,
  ): Promise<Candle[]> {
    return this.resolveExchange(exchange).getCandles(symbol, interval);
  }
}

export const marketService = new MarketService();
