import type {
  Candle,
  MarketSummary,
  MarketTrade,
  OrderBook,
  Ticker,
} from "../../types/market.js";
import {
  getExchange,
  parseExchangeName,
  type ExchangeName,
} from "../exchanges/index.js";
import type { Exchange } from "../exchanges/types.js";

const SUMMARY_CACHE_TTL_MS = 45_000;
const TICKER_CONCURRENCY = 8;
const CHANGE_CONCURRENCY = 4;

interface SummaryCacheEntry {
  expiresAt: number;
  tickers: Ticker[];
}

export interface GetSummariesOptions {
  exchange?: string | ExchangeName;
  quote?: string;
  symbols?: string[];
  limit?: number;
  offset?: number;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function filterByQuote(symbols: string[], quote?: string): string[] {
  if (!quote || quote.toUpperCase() === "ALL") {
    return symbols;
  }
  const suffix = `-${quote.toUpperCase()}`;
  return symbols.filter((symbol) => symbol.endsWith(suffix));
}

function changeFromCandles(
  last: number,
  candles: Candle[],
): number | undefined {
  if (!Number.isFinite(last) || candles.length === 0) {
    return undefined;
  }
  const sorted = [...candles].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const openCandle = sorted[Math.max(0, sorted.length - 24)] ?? sorted[0];
  const open = openCandle.open;
  if (!Number.isFinite(open) || open === 0) {
    return undefined;
  }
  return ((last - open) / open) * 100;
}

export class MarketService {
  private summaryTickerCache = new Map<string, SummaryCacheEntry>();

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

  async getSummaries(options: GetSummariesOptions = {}): Promise<{
    items: MarketSummary[];
    total: number;
  }> {
    const exchangeName = this.getExchangeName(options.exchange);
    const exchange = this.resolveExchange(options.exchange);
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(100, Math.max(1, options.limit ?? 40));

    // Explicit symbol list (Browse page / Watchlist enrichment).
    if (options.symbols && options.symbols.length > 0) {
      const available = new Set(await exchange.listSymbols());
      const requested = options.symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0 && available.has(symbol));

      const tickers = await this.fetchTickers(exchange, requested);
      const items = await this.enrichWithChange(tickers, exchange);
      // Preserve request order for Browse pages.
      const bySymbol = new Map(items.map((item) => [item.symbol, item]));
      return {
        items: requested
          .map((symbol) => bySymbol.get(symbol))
          .filter((item): item is MarketSummary => item !== undefined),
        total: requested.length,
      };
    }

    // Quote universe (Top / Browse without explicit symbols).
    const quote = (options.quote ?? "USD").toUpperCase();
    const tickers = await this.getCachedQuoteTickers(
      exchangeName,
      exchange,
      quote,
    );
    const sorted = [...tickers].sort((a, b) => b.volume24h - a.volume24h);
    const page = sorted.slice(offset, offset + limit);
    const items = await this.enrichWithChange(page, exchange);
    return { items, total: sorted.length };
  }

  private async fetchTickers(
    exchange: Exchange,
    symbols: string[],
  ): Promise<Ticker[]> {
    const tickers = await mapPool(
      symbols,
      TICKER_CONCURRENCY,
      async (symbol) => {
        try {
          return await exchange.getTicker(symbol);
        } catch {
          return null;
        }
      },
    );
    return tickers.filter((ticker): ticker is Ticker => ticker !== null);
  }

  private async getCachedQuoteTickers(
    exchangeName: string,
    exchange: Exchange,
    quote: string,
  ): Promise<Ticker[]> {
    const cacheKey = `${exchangeName}:${quote}`;
    const cached = this.summaryTickerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tickers;
    }

    const allSymbols = await exchange.listSymbols();
    const filtered = filterByQuote(allSymbols, quote);
    const valid = await this.fetchTickers(exchange, filtered);
    this.summaryTickerCache.set(cacheKey, {
      expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS,
      tickers: valid,
    });
    return valid;
  }

  private async enrichWithChange(
    tickers: Ticker[],
    exchange: Exchange,
  ): Promise<MarketSummary[]> {
    return mapPool(tickers, CHANGE_CONCURRENCY, async (ticker) => {
      let change24h: number | undefined;
      try {
        const candles = await exchange.getCandles(ticker.symbol, "1h");
        change24h = changeFromCandles(ticker.last, candles);
      } catch {
        change24h = undefined;
      }

      return {
        symbol: ticker.symbol,
        bid: ticker.bid,
        ask: ticker.ask,
        last: ticker.last,
        volume24h: ticker.volume24h,
        ...(change24h !== undefined ? { change24h } : {}),
        timestamp: ticker.timestamp,
      };
    });
  }
}

export const marketService = new MarketService();
