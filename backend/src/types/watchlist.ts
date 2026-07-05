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

export interface WatchlistItemWithQuote {
  id: string;
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  addedAt: string;
}

export interface WatchlistView {
  id: string;
  name: string;
  items: WatchlistItemWithQuote[];
}
