import { pool } from "../config/database.js";
import type { Watchlist } from "../types/watchlist.js";

interface WatchlistRow {
  id: string;
  user_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

function mapWatchlist(row: WatchlistRow): Watchlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findWatchlistByUserId(
  userId: string,
  name = "Default",
): Promise<Watchlist | null> {
  const result = await pool.query<WatchlistRow>(
    `SELECT id, user_id, name, created_at, updated_at
     FROM watchlists
     WHERE user_id = $1 AND name = $2`,
    [userId, name],
  );

  return result.rows[0] ? mapWatchlist(result.rows[0]) : null;
}

export async function createWatchlist(
  userId: string,
  name = "Default",
): Promise<Watchlist> {
  const result = await pool.query<WatchlistRow>(
    `INSERT INTO watchlists (user_id, name)
     VALUES ($1, $2)
     RETURNING id, user_id, name, created_at, updated_at`,
    [userId, name],
  );

  return mapWatchlist(result.rows[0]);
}
