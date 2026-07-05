import type { PoolClient } from "pg";
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

export async function findPositionForUpdate(
  client: PoolClient,
  userId: string,
  symbol: string,
): Promise<Position | null> {
  const result = await client.query<PositionRow>(
    `SELECT id, user_id, symbol, quantity, average_cost, created_at, updated_at
     FROM positions
     WHERE user_id = $1 AND symbol = $2
     FOR UPDATE`,
    [userId, symbol],
  );

  return result.rows[0] ? mapPosition(result.rows[0]) : null;
}

export async function upsertPosition(
  client: PoolClient,
  input: {
    userId: string;
    symbol: string;
    quantity: number;
    averageCost: number;
  },
): Promise<Position> {
  const result = await client.query<PositionRow>(
    `INSERT INTO positions (user_id, symbol, quantity, average_cost)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, symbol)
     DO UPDATE SET
       quantity = EXCLUDED.quantity,
       average_cost = EXCLUDED.average_cost,
       updated_at = NOW()
     RETURNING id, user_id, symbol, quantity, average_cost, created_at, updated_at`,
    [input.userId, input.symbol, input.quantity, input.averageCost],
  );

  return mapPosition(result.rows[0]);
}

export async function deletePosition(
  client: PoolClient,
  userId: string,
  symbol: string,
): Promise<void> {
  await client.query(
    `DELETE FROM positions
     WHERE user_id = $1 AND symbol = $2`,
    [userId, symbol],
  );
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
