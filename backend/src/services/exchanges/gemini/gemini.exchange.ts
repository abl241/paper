import { AppError } from "../../../types/api.js";
import type { Candle, MarketTrade, OrderBook, Ticker } from "../../../types/market.js";
import { normalizeSymbol } from "../../../utils/symbols.js";
import type { Exchange } from "../types.js";
import { GeminiClient } from "./gemini.client.js";
import {
  mapGeminiCandles,
  mapGeminiOrderBook,
  mapGeminiSymbols,
  mapGeminiTicker,
  mapGeminiTrades,
  toGeminiSymbol,
} from "./gemini.mapper.js";
import type {
  GeminiCandleResponse,
  GeminiOrderBookResponse,
  GeminiTickerResponse,
  GeminiTradeResponse,
} from "./gemini.types.js";

/** Cap Gemini's large candle payloads to a usable recent window. */
const CANDLE_LOOKBACK_MS: Record<string, number> = {
  "1m": 1000 * 60 * 60 * 24,
  "5m": 1000 * 60 * 60 * 24 * 7,
  "15m": 1000 * 60 * 60 * 24 * 21,
  "30m": 1000 * 60 * 60 * 24 * 45,
  "1hr": 1000 * 60 * 60 * 24 * 90,
  "6hr": 1000 * 60 * 60 * 24 * 180,
  "1day": 1000 * 60 * 60 * 24 * 730,
};

export class GeminiExchange implements Exchange {
  readonly name = "gemini";

  constructor(private readonly client: GeminiClient) {}

  async listSymbols(): Promise<string[]> {
    const symbols = await this.client.get<string[]>("/v1/symbols");
    const spotSymbols = symbols.filter((symbol) => !symbol.endsWith("perp"));
    return mapGeminiSymbols(spotSymbols);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const geminiSymbol = this.toExchangeSymbol(symbol);
    const data = await this.client.get<GeminiTickerResponse>(
      `/v1/pubticker/${geminiSymbol}`,
    );
    return mapGeminiTicker(symbol, data);
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const geminiSymbol = this.toExchangeSymbol(symbol);
    const data = await this.client.get<GeminiOrderBookResponse>(
      `/v1/book/${geminiSymbol}`,
    );
    return mapGeminiOrderBook(symbol, data);
  }

  async getTrades(symbol: string): Promise<MarketTrade[]> {
    const geminiSymbol = this.toExchangeSymbol(symbol);
    const data = await this.client.get<GeminiTradeResponse[]>(
      `/v1/trades/${geminiSymbol}`,
    );
    return mapGeminiTrades(symbol, data);
  }

  async getCandles(symbol: string, interval: string): Promise<Candle[]> {
    const geminiSymbol = this.toExchangeSymbol(symbol);
    const timeframe = this.toGeminiTimeframe(interval);
    const data = await this.client.get<GeminiCandleResponse[]>(
      `/v2/candles/${geminiSymbol}/${timeframe}`,
    );
    const candles = mapGeminiCandles(symbol, data);
    const lookbackMs = CANDLE_LOOKBACK_MS[timeframe];
    if (!lookbackMs || candles.length === 0) {
      return candles;
    }

    const cutoff = Date.now() - lookbackMs;
    return candles.filter((candle) => candle.timestamp.getTime() >= cutoff);
  }

  private toExchangeSymbol(symbol: string): string {
    try {
      return toGeminiSymbol(normalizeSymbol(symbol));
    } catch {
      throw new AppError(`Invalid symbol: ${symbol}`, 400, "INVALID_SYMBOL");
    }
  }

  private toGeminiTimeframe(interval: string): string {
    const mapping: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1hr",
      "1hr": "1hr",
      "4h": "6hr",
      "6h": "6hr",
      "6hr": "6hr",
      "1d": "1day",
      "1day": "1day",
    };

    const timeframe = mapping[interval.toLowerCase()];
    if (!timeframe) {
      throw new AppError(`Unsupported candle interval: ${interval}`, 400, "INVALID_INTERVAL");
    }

    return timeframe;
  }
}

export function createGeminiExchange(baseUrl: string): GeminiExchange {
  return new GeminiExchange(new GeminiClient(baseUrl));
}
