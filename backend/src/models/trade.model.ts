import type { PoolClient } from "pg";
import { pool } from "../config/database.js";
import type { Trade } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface TradeRow {
  id: string;
  user_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  execution_price: string;
  realized_pnl: string | null;
  executed_at: Date;
}

function mapTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    side: row.side,
    quantity: parseDecimal(row.quantity),
    executionPrice: parseDecimal(row.execution_price),
    realizedPnL: row.realized_pnl === null ? null : parseDecimal(row.realized_pnl),
    executedAt: row.executed_at,
  };
}

export async function insertTrade(
  client: PoolClient,
  input: {
    userId: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    executionPrice: number;
    realizedPnL: number | null;
  },
): Promise<Trade> {
  const result = await client.query<TradeRow>(
    `INSERT INTO trades (user_id, symbol, side, quantity, execution_price, realized_pnl)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, symbol, side, quantity, execution_price, realized_pnl, executed_at`,
    [
      input.userId,
      input.symbol,
      input.side,
      input.quantity,
      input.executionPrice,
      input.realizedPnL,
    ],
  );

  return mapTrade(result.rows[0]);
}

export async function findTradesByUserId(userId: string): Promise<Trade[]> {
  const result = await pool.query<TradeRow>(
    `SELECT id, user_id, symbol, side, quantity, execution_price, realized_pnl, executed_at
     FROM trades
     WHERE user_id = $1
     ORDER BY executed_at DESC`,
    [userId],
  );

  return result.rows.map(mapTrade);
}
