import { pool } from "../config/database.js";
import type { Position } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface PositionRow {
  id: string;
  user_id: string;
  symbol: string;
  quantity: string;
  average_cost: string;
  created_at: Date;
  updated_at: Date;
}

function mapPosition(row: PositionRow): Position {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    quantity: parseDecimal(row.quantity),
    averageCost: parseDecimal(row.average_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findPositionsByUserId(userId: string): Promise<Position[]> {
  const result = await pool.query<PositionRow>(
    `SELECT id, user_id, symbol, quantity, average_cost, created_at, updated_at
     FROM positions
     WHERE user_id = $1
     ORDER BY symbol ASC`,
    [userId],
  );

  return result.rows.map(mapPosition);
}
