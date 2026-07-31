import { apiClient } from "./client";
import type {
  ApiResponse,
  Candle,
  MarketSummariesResponse,
  MarketTrade,
  OrderBook,
  Ticker,
} from "../types/market";
import { getPreferredExchange } from "../utils/preferredExchange";

function exchangeParams(extra?: Record<string, string>): {
  params: Record<string, string>;
} {
  return {
    params: {
      exchange: getPreferredExchange(),
      ...extra,
    },
  };
}

export async function listSymbols(): Promise<string[]> {
  const { data } = await apiClient.get<ApiResponse<string[]>>(
    "/markets/symbols",
    exchangeParams(),
  );
  return data.data;
}

export async function getMarketSummaries(options?: {
  quote?: string;
  symbols?: string[];
  limit?: number;
  offset?: number;
}): Promise<MarketSummariesResponse> {
  const extra: Record<string, string> = {};
  if (options?.quote) extra.quote = options.quote;
  if (options?.symbols?.length) extra.symbols = options.symbols.join(",");
  if (options?.limit !== undefined) extra.limit = String(options.limit);
  if (options?.offset !== undefined) extra.offset = String(options.offset);

  const { data } = await apiClient.get<ApiResponse<MarketSummariesResponse>>(
    "/markets/summaries",
    {
      ...exchangeParams(extra),
      timeout: 60_000,
    },
  );
  return data.data;
}

export async function getTicker(symbol: string): Promise<Ticker> {
  const { data } = await apiClient.get<ApiResponse<Ticker>>(
    `/markets/ticker/${encodeURIComponent(symbol)}`,
    exchangeParams(),
  );
  return data.data;
}

export async function getOrderBook(symbol: string): Promise<OrderBook> {
  const { data } = await apiClient.get<ApiResponse<OrderBook>>(
    `/markets/orderbook/${encodeURIComponent(symbol)}`,
    exchangeParams(),
  );
  return data.data;
}

export async function getTrades(symbol: string): Promise<MarketTrade[]> {
  const { data } = await apiClient.get<ApiResponse<MarketTrade[]>>(
    `/markets/trades/${encodeURIComponent(symbol)}`,
    exchangeParams(),
  );
  return data.data;
}

export async function getCandles(
  symbol: string,
  interval: string,
  options?: { fullHistory?: boolean },
): Promise<Candle[]> {
  const extra: Record<string, string> = { interval };
  if (options?.fullHistory) {
    extra.history = "full";
  }
  const { data } = await apiClient.get<ApiResponse<Candle[]>>(
    `/markets/candles/${encodeURIComponent(symbol)}`,
    {
      ...exchangeParams(extra),
      ...(options?.fullHistory ? { timeout: 90_000 } : {}),
    },
  );
  return data.data;
}
