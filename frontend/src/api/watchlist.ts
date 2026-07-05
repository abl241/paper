import { apiClient } from "./client";
import type { ApiResponse, Watchlist } from "../types/watchlist";

export async function getWatchlist(): Promise<Watchlist> {
  const { data } = await apiClient.get<ApiResponse<Watchlist>>("/watchlist");
  return data.data;
}

export async function addWatchlistItem(symbol: string): Promise<Watchlist> {
  const { data } = await apiClient.post<ApiResponse<Watchlist>>("/watchlist/items", {
    symbol,
  });
  return data.data;
}

export async function removeWatchlistItem(symbol: string): Promise<Watchlist> {
  const { data } = await apiClient.delete<ApiResponse<Watchlist>>(
    `/watchlist/items/${encodeURIComponent(symbol)}`,
  );
  return data.data;
}
