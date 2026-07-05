import { apiClient } from "./client";
import type { ApiResponse, MarketTrade, OrderBook, Ticker } from "../types/market";

export async function listSymbols(): Promise<string[]> {
  const { data } = await apiClient.get<ApiResponse<string[]>>("/markets/symbols");
  return data.data;
}

export async function getTicker(symbol: string): Promise<Ticker> {
  const { data } = await apiClient.get<ApiResponse<Ticker>>(
    `/markets/ticker/${encodeURIComponent(symbol)}`,
  );
  return data.data;
}

export async function getOrderBook(symbol: string): Promise<OrderBook> {
  const { data } = await apiClient.get<ApiResponse<OrderBook>>(
    `/markets/orderbook/${encodeURIComponent(symbol)}`,
  );
  return data.data;
}

export async function getTrades(symbol: string): Promise<MarketTrade[]> {
  const { data } = await apiClient.get<ApiResponse<MarketTrade[]>>(
    `/markets/trades/${encodeURIComponent(symbol)}`,
  );
  return data.data;
}
