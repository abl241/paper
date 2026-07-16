import { apiClient } from "./client";
import type { ApiResponse, Candle, MarketTrade, OrderBook, Ticker } from "../types/market";
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
): Promise<Candle[]> {
  const { data } = await apiClient.get<ApiResponse<Candle[]>>(
    `/markets/candles/${encodeURIComponent(symbol)}`,
    exchangeParams({ interval }),
  );
  return data.data;
}
