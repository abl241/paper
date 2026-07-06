import type {
  Candle,
  MarketTrade,
  OrderBook,
  OrderBookLevel,
  Ticker,
} from "../../../types/market.js";
import { fromGeminiSymbol, normalizeSymbol, toGeminiSymbol } from "../../../utils/symbols.js";
import type {
  GeminiCandleResponse,
  GeminiOrderBookResponse,
  GeminiTickerResponse,
  GeminiTradeResponse,
} from "./gemini.types.js";

function parseNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}: ${value}`);
  }
  return parsed;
}

function mapOrderBookSide(
  levels: { price: string; amount: string }[],
): OrderBookLevel[] {
  return levels.map((level) => ({
    price: parseNumber(level.price, "price"),
    quantity: parseNumber(level.amount, "quantity"),
  }));
}

function quoteVolume(
  symbol: string,
  volume: Record<string, string> | undefined,
): number {
  if (!volume) {
    return 0;
  }

  const quote = normalizeSymbol(symbol).split("-")[1]?.toLowerCase();
  const entries = Object.entries(volume).filter(([key]) => key !== "timestamp");

  if (quote) {
    const match = entries.find(([key]) => key.toLowerCase() === quote);
    if (match) {
      return parseNumber(match[1], "volume");
    }
  }

  const firstValue = entries[0]?.[1];
  return firstValue ? parseNumber(firstValue, "volume") : 0;
}

export function mapGeminiTicker(
  symbol: string,
  data: GeminiTickerResponse,
): Ticker {
  return {
    symbol: normalizeSymbol(symbol),
    bid: parseNumber(data.bid, "bid"),
    ask: parseNumber(data.ask, "ask"),
    last: parseNumber(data.last, "last"),
    volume24h: quoteVolume(symbol, data.volume),
    timestamp: new Date(),
  };
}

export function mapGeminiOrderBook(
  symbol: string,
  data: GeminiOrderBookResponse,
): OrderBook {
  return {
    symbol: normalizeSymbol(symbol),
    bids: mapOrderBookSide(data.bids),
    asks: mapOrderBookSide(data.asks),
    timestamp: new Date(),
  };
}

export function mapGeminiTrades(
  symbol: string,
  data: GeminiTradeResponse[],
): MarketTrade[] {
  const normalizedSymbol = normalizeSymbol(symbol);

  return data.map((trade) => ({
    symbol: normalizedSymbol,
    price: parseNumber(trade.price, "price"),
    quantity: parseNumber(trade.amount, "quantity"),
    side: trade.type,
    timestamp: new Date(trade.timestampms ?? trade.timestamp * 1000),
  }));
}

export function mapGeminiCandles(
  symbol: string,
  data: GeminiCandleResponse[],
): Candle[] {
  const normalizedSymbol = normalizeSymbol(symbol);

  return data.map(([timestamp, open, high, low, close, volume]) => ({
    symbol: normalizedSymbol,
    open: parseNumber(open, "open"),
    high: parseNumber(high, "high"),
    low: parseNumber(low, "low"),
    close: parseNumber(close, "close"),
    volume: parseNumber(volume, "volume"),
    timestamp: new Date(timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000),
  }));
}

export function mapGeminiSymbols(symbols: string[]): string[] {
  const normalized: string[] = [];

  for (const symbol of symbols) {
    try {
      normalized.push(fromGeminiSymbol(symbol));
    } catch {
      // Skip symbols that don't match supported spot pair formats.
    }
  }

  return normalized.sort();
}

export { toGeminiSymbol };
