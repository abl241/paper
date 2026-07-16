import { AppError } from "../../../types/api.js";
import type { Candle, MarketTrade, OrderBook, Ticker } from "../../../types/market.js";
import { normalizeSymbol } from "../../../utils/symbols.js";
import type { Exchange } from "../types.js";
import { CoinbaseClient } from "./coinbase.client.js";
import {
  mapCoinbaseCandles,
  mapCoinbaseOrderBook,
  mapCoinbaseSymbols,
  mapCoinbaseTicker,
  mapCoinbaseTrades,
  toCoinbaseProductId,
} from "./coinbase.mapper.js";
import type {
  CoinbaseCandlesResponse,
  CoinbaseProduct,
  CoinbaseProductBookResponse,
  CoinbaseProductsResponse,
  CoinbaseTickerResponse,
} from "./coinbase.types.js";

const CANDLE_LOOKBACK_SECONDS: Record<string, number> = {
  ONE_HOUR: 60 * 60 * 48,
  SIX_HOUR: 60 * 60 * 24 * 14,
  ONE_DAY: 60 * 60 * 24 * 90,
};

export class CoinbaseExchange implements Exchange {
  readonly name = "coinbase";

  constructor(private readonly client: CoinbaseClient) {}

  async listSymbols(): Promise<string[]> {
    const products: CoinbaseProduct[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.client.get<
        CoinbaseProductsResponse & {
          pagination?: { next_cursor?: string; has_next?: boolean };
        }
      >("/api/v3/brokerage/market/products", {
        product_type: "SPOT",
        limit: 1000,
        cursor,
      });

      products.push(...(data.products ?? []));
      cursor = data.pagination?.has_next
        ? data.pagination.next_cursor
        : undefined;
    } while (cursor);

    return mapCoinbaseSymbols(products);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const productId = this.toExchangeSymbol(symbol);

    const [ticker, product] = await Promise.all([
      this.client.get<CoinbaseTickerResponse>(
        `/api/v3/brokerage/market/products/${encodeURIComponent(productId)}/ticker`,
        { limit: 1 },
      ),
      this.client
        .get<CoinbaseProduct>(
          `/api/v3/brokerage/market/products/${encodeURIComponent(productId)}`,
        )
        .catch(() => null),
    ]);

    const volume24h = product?.volume_24h
      ? Number(product.volume_24h)
      : 0;

    return mapCoinbaseTicker(
      symbol,
      ticker,
      Number.isFinite(volume24h) ? volume24h : 0,
    );
  }

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const productId = this.toExchangeSymbol(symbol);
    const data = await this.client.get<CoinbaseProductBookResponse>(
      "/api/v3/brokerage/market/product_book",
      { product_id: productId, limit: 50 },
    );
    return mapCoinbaseOrderBook(symbol, data);
  }

  async getTrades(symbol: string): Promise<MarketTrade[]> {
    const productId = this.toExchangeSymbol(symbol);
    const data = await this.client.get<CoinbaseTickerResponse>(
      `/api/v3/brokerage/market/products/${encodeURIComponent(productId)}/ticker`,
      { limit: 50 },
    );
    return mapCoinbaseTrades(symbol, data.trades ?? []);
  }

  async getCandles(symbol: string, interval: string): Promise<Candle[]> {
    const productId = this.toExchangeSymbol(symbol);
    const granularity = this.toCoinbaseGranularity(interval);
    const end = Math.floor(Date.now() / 1000);
    const start = end - (CANDLE_LOOKBACK_SECONDS[granularity] ?? 60 * 60 * 48);

    const data = await this.client.get<CoinbaseCandlesResponse>(
      `/api/v3/brokerage/market/products/${encodeURIComponent(productId)}/candles`,
      { start, end, granularity },
    );

    return mapCoinbaseCandles(symbol, data.candles ?? []);
  }

  private toExchangeSymbol(symbol: string): string {
    try {
      return toCoinbaseProductId(normalizeSymbol(symbol));
    } catch {
      throw new AppError(`Invalid symbol: ${symbol}`, 400, "INVALID_SYMBOL");
    }
  }

  private toCoinbaseGranularity(interval: string): string {
    const mapping: Record<string, string> = {
      "1h": "ONE_HOUR",
      "1hr": "ONE_HOUR",
      "6h": "SIX_HOUR",
      "6hr": "SIX_HOUR",
      "1d": "ONE_DAY",
      "1day": "ONE_DAY",
    };

    const granularity = mapping[interval.toLowerCase()];
    if (!granularity) {
      throw new AppError(
        `Unsupported candle interval: ${interval}`,
        400,
        "INVALID_INTERVAL",
      );
    }

    return granularity;
  }
}

export function createCoinbaseExchange(baseUrl: string): CoinbaseExchange {
  return new CoinbaseExchange(new CoinbaseClient(baseUrl));
}
