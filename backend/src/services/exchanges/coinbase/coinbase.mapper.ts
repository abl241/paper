import type {
  Candle,
  MarketTrade,
  OrderBook,
  OrderBookLevel,
  Ticker,
} from "../../../types/market.js";
import { normalizeSymbol } from "../../../utils/symbols.js";
import type {
  CoinbaseBookLevel,
  CoinbaseCandle,
  CoinbaseProduct,
  CoinbaseProductBookResponse,
  CoinbaseTickerResponse,
  CoinbaseTrade,
} from "./coinbase.types.js";

function parseNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}: ${value}`);
  }
  return parsed;
}

function mapOrderBookSide(levels: CoinbaseBookLevel[]): OrderBookLevel[] {
  return levels.map((level) => ({
    price: parseNumber(level.price, "price"),
    quantity: parseNumber(level.size, "quantity"),
  }));
}

export function toCoinbaseProductId(symbol: string): string {
  return normalizeSymbol(symbol);
}

export function mapCoinbaseSymbols(products: CoinbaseProduct[]): string[] {
  const symbols: string[] = [];

  for (const product of products) {
    if (product.product_type && product.product_type !== "SPOT") {
      continue;
    }
    if (product.trading_disabled) {
      continue;
    }
    if (product.status && product.status !== "online") {
      continue;
    }
    if (!product.product_id?.includes("-")) {
      continue;
    }

    try {
      symbols.push(normalizeSymbol(product.product_id));
    } catch {
      // Skip unsupported product ids.
    }
  }

  return [...new Set(symbols)].sort();
}

export function mapCoinbaseTicker(
  symbol: string,
  data: CoinbaseTickerResponse,
  volume24h = 0,
): Ticker {
  const lastTrade = data.trades[0];
  const last = lastTrade
    ? parseNumber(lastTrade.price, "last")
    : parseNumber(data.best_bid || data.best_ask || "0", "last");

  return {
    symbol: normalizeSymbol(symbol),
    bid: parseNumber(data.best_bid || String(last), "bid"),
    ask: parseNumber(data.best_ask || String(last), "ask"),
    last,
    volume24h,
    timestamp: lastTrade ? new Date(lastTrade.time) : new Date(),
  };
}

export function mapCoinbaseOrderBook(
  symbol: string,
  data: CoinbaseProductBookResponse,
): OrderBook {
  return {
    symbol: normalizeSymbol(symbol),
    bids: mapOrderBookSide(data.pricebook.bids),
    asks: mapOrderBookSide(data.pricebook.asks),
    timestamp: data.pricebook.time
      ? new Date(data.pricebook.time)
      : new Date(),
  };
}

export function mapCoinbaseTrades(
  symbol: string,
  trades: CoinbaseTrade[],
): MarketTrade[] {
  const normalizedSymbol = normalizeSymbol(symbol);

  return trades.map((trade) => ({
    symbol: normalizedSymbol,
    price: parseNumber(trade.price, "price"),
    quantity: parseNumber(trade.size, "quantity"),
    side: trade.side.toLowerCase() === "sell" ? "sell" : "buy",
    timestamp: new Date(trade.time),
  }));
}

export function mapCoinbaseCandles(
  symbol: string,
  candles: CoinbaseCandle[],
): Candle[] {
  const normalizedSymbol = normalizeSymbol(symbol);

  return candles.map((candle) => ({
    symbol: normalizedSymbol,
    open: parseNumber(candle.open, "open"),
    high: parseNumber(candle.high, "high"),
    low: parseNumber(candle.low, "low"),
    close: parseNumber(candle.close, "close"),
    volume: parseNumber(candle.volume, "volume"),
    timestamp: new Date(Number(candle.start) * 1000),
  }));
}
