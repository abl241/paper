export type { WatchlistItemWithQuote, WatchlistView } from "@paper/shared";

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  symbol: string;
  createdAt: Date;
}
