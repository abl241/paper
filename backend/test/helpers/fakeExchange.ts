import {
  setExchangeInstance,
  type ExchangeName,
} from "../../src/services/exchanges/index.js";
import type { Exchange } from "../../src/services/exchanges/types.js";
import type {
  Candle,
  MarketTrade,
  OrderBook,
  Ticker,
} from "../../src/types/market.js";

export interface FakeBar {
  /** Unix seconds (bar open time). */
  time: number;
  open: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

/** Deterministic in-memory Exchange. Tests control candles and quotes directly. */
export class FakeExchange implements Exchange {
  readonly name: string;
  private readonly candles = new Map<string, Candle[]>();
  private readonly tickers = new Map<string, Ticker>();
  /** Calls per method, for asserting upstream traffic. */
  readonly calls = { getTicker: 0, getCandles: 0 };

  constructor(name: ExchangeName = "gemini") {
    this.name = name;
  }

  setTicker(symbol: string, quote: { bid: number; ask: number; last?: number }): void {
    this.tickers.set(symbol, {
      symbol,
      bid: quote.bid,
      ask: quote.ask,
      last: quote.last ?? (quote.bid + quote.ask) / 2,
      volume24h: 0,
      timestamp: new Date(),
    });
  }

  setBars(symbol: string, interval: string, bars: FakeBar[]): void {
    this.candles.set(key(symbol, interval), bars.map((bar) => toCandle(symbol, bar)));
  }

  appendBars(symbol: string, interval: string, bars: FakeBar[]): void {
    const existing = this.candles.get(key(symbol, interval)) ?? [];
    this.candles.set(key(symbol, interval), [
      ...existing,
      ...bars.map((bar) => toCandle(symbol, bar)),
    ]);
  }

  async listSymbols(): Promise<string[]> {
    return [...new Set([...this.tickers.keys()])];
  }

  async getTicker(symbol: string): Promise<Ticker> {
    this.calls.getTicker += 1;
    const ticker = this.tickers.get(symbol);
    if (!ticker) throw new Error(`FakeExchange: no ticker for ${symbol}`);
    return { ...ticker };
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    return { symbol, bids: [], asks: [], timestamp: new Date() };
  }

  async getTrades(): Promise<MarketTrade[]> {
    return [];
  }

  async getCandles(symbol: string, interval: string): Promise<Candle[]> {
    this.calls.getCandles += 1;
    return (this.candles.get(key(symbol, interval)) ?? []).map((c) => ({ ...c }));
  }
}

/** Install a fresh FakeExchange as the adapter for `name` (default gemini). */
export function installFakeExchange(name: ExchangeName = "gemini"): FakeExchange {
  const fake = new FakeExchange(name);
  setExchangeInstance(name, fake);
  return fake;
}

function key(symbol: string, interval: string): string {
  return `${symbol}:${interval.toLowerCase()}`;
}

function toCandle(symbol: string, bar: FakeBar): Candle {
  return {
    symbol,
    open: bar.open,
    high: bar.high ?? Math.max(bar.open, bar.close),
    low: bar.low ?? Math.min(bar.open, bar.close),
    close: bar.close,
    volume: bar.volume ?? 1,
    timestamp: new Date(bar.time * 1000),
  };
}
