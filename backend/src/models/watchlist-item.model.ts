import { pool } from "../config/database.js";
import type { WatchlistItem } from "../types/watchlist.js";

interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  symbol: string;
  created_at: Date;
}

function mapWatchlistItem(row: WatchlistItemRow): WatchlistItem {
  return {
    id: row.id,
    watchlistId: row.watchlist_id,
    symbol: row.symbol,
    createdAt: row.created_at,
  };
}

export async function findWatchlistItems(
  watchlistId: string,
): Promise<WatchlistItem[]> {
  const result = await pool.query<WatchlistItemRow>(
    `SELECT id, watchlist_id, symbol, created_at
     FROM watchlist_items
     WHERE watchlist_id = $1
     ORDER BY created_at ASC`,
    [watchlistId],
  );

  return result.rows.map(mapWatchlistItem);
}

export async function addWatchlistItem(
  watchlistId: string,
  symbol: string,
): Promise<WatchlistItem> {
  const result = await pool.query<WatchlistItemRow>(
    `INSERT INTO watchlist_items (watchlist_id, symbol)
     VALUES ($1, $2)
     ON CONFLICT (watchlist_id, symbol) DO UPDATE
     SET symbol = EXCLUDED.symbol
     RETURNING id, watchlist_id, symbol, created_at`,
    [watchlistId, symbol],
  );

  return mapWatchlistItem(result.rows[0]);
}

export async function removeWatchlistItem(
  watchlistId: string,
  symbol: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM watchlist_items
     WHERE watchlist_id = $1 AND symbol = $2`,
    [watchlistId, symbol],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function watchlistItemExists(
  watchlistId: string,
  symbol: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM watchlist_items
     WHERE watchlist_id = $1 AND symbol = $2`,
    [watchlistId, symbol],
  );

  return (result.rowCount ?? 0) > 0;
}
