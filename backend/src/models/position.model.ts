import type { PoolClient } from "pg";
import { pool } from "../config/database.js";
import type { Position } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface PositionRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: string;
  average_cost: string;
  created_at: Date;
  updated_at: Date;
}

function mapPosition(row: PositionRow): Position {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    quantity: parseDecimal(row.quantity),
    averageCost: parseDecimal(row.average_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findPositionForUpdate(
  client: PoolClient,
  portfolioId: string,
  symbol: string,
): Promise<Position | null> {
  const result = await client.query<PositionRow>(
    `SELECT id, portfolio_id, symbol, quantity, average_cost, created_at, updated_at
     FROM positions
     WHERE portfolio_id = $1 AND symbol = $2
     FOR UPDATE`,
    [portfolioId, symbol],
  );

  return result.rows[0] ? mapPosition(result.rows[0]) : null;
}

export async function upsertPosition(
  client: PoolClient,
  input: {
    portfolioId: string;
    symbol: string;
    quantity: number;
    averageCost: number;
  },
): Promise<Position> {
  const result = await client.query<PositionRow>(
    `INSERT INTO positions (portfolio_id, symbol, quantity, average_cost)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (portfolio_id, symbol)
     DO UPDATE SET
       quantity = EXCLUDED.quantity,
       average_cost = EXCLUDED.average_cost,
       updated_at = NOW()
     RETURNING id, portfolio_id, symbol, quantity, average_cost, created_at, updated_at`,
    [input.portfolioId, input.symbol, input.quantity, input.averageCost],
  );

  return mapPosition(result.rows[0]);
}

export async function deletePosition(
  client: PoolClient,
  portfolioId: string,
  symbol: string,
): Promise<void> {
  await client.query(
    `DELETE FROM positions
     WHERE portfolio_id = $1 AND symbol = $2`,
    [portfolioId, symbol],
  );
}

export async function findPositionsByPortfolioId(
  portfolioId: string,
): Promise<Position[]> {
  const result = await pool.query<PositionRow>(
    `SELECT id, portfolio_id, symbol, quantity, average_cost, created_at, updated_at
     FROM positions
     WHERE portfolio_id = $1
     ORDER BY symbol ASC`,
    [portfolioId],
  );

  return result.rows.map(mapPosition);
}

export async function deleteAllPositions(
  client: PoolClient,
  portfolioId: string,
): Promise<void> {
  await client.query(`DELETE FROM positions WHERE portfolio_id = $1`, [
    portfolioId,
  ]);
}
