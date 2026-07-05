export interface WatchlistItemWithQuote {
  id: string;
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  addedAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  items: WatchlistItemWithQuote[];
}

export interface ApiResponse<T> {
  data: T;
}
