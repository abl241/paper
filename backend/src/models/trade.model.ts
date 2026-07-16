import type { PoolClient } from "pg";
import { pool } from "../config/database.js";
import type { Trade, TradeFilters } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface TradeRow {
  id: string;
  portfolio_id: string;
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
    portfolioId: row.portfolio_id,
    symbol: row.symbol,
    side: row.side,
    quantity: parseDecimal(row.quantity),
    executionPrice: parseDecimal(row.execution_price),
    realizedPnL:
      row.realized_pnl === null ? null : parseDecimal(row.realized_pnl),
    executedAt: row.executed_at,
  };
}

export async function insertTrade(
  client: PoolClient,
  input: {
    portfolioId: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    executionPrice: number;
    realizedPnL: number | null;
  },
): Promise<Trade> {
  const result = await client.query<TradeRow>(
    `INSERT INTO trades (portfolio_id, symbol, side, quantity, execution_price, realized_pnl)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, portfolio_id, symbol, side, quantity, execution_price, realized_pnl, executed_at`,
    [
      input.portfolioId,
      input.symbol,
      input.side,
      input.quantity,
      input.executionPrice,
      input.realizedPnL,
    ],
  );

  return mapTrade(result.rows[0]);
}

export async function findTradesByPortfolioId(
  portfolioId: string,
  filters: TradeFilters = {},
): Promise<Trade[]> {
  const clauses = ["portfolio_id = $1"];
  const params: unknown[] = [portfolioId];

  if (filters.symbol) {
    params.push(filters.symbol);
    clauses.push(`symbol = $${params.length}`);
  }
  if (filters.side) {
    params.push(filters.side);
    clauses.push(`side = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`executed_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`executed_at <= $${params.length}`);
  }

  const result = await pool.query<TradeRow>(
    `SELECT id, portfolio_id, symbol, side, quantity, execution_price, realized_pnl, executed_at
     FROM trades
     WHERE ${clauses.join(" AND ")}
     ORDER BY executed_at DESC`,
    params,
  );

  return result.rows.map(mapTrade);
}

export async function findTradesChronological(
  portfolioId: string,
): Promise<Trade[]> {
  const result = await pool.query<TradeRow>(
    `SELECT id, portfolio_id, symbol, side, quantity, execution_price, realized_pnl, executed_at
     FROM trades
     WHERE portfolio_id = $1
     ORDER BY executed_at ASC`,
    [portfolioId],
  );
  return result.rows.map(mapTrade);
}

export async function deleteAllTrades(
  client: PoolClient,
  portfolioId: string,
): Promise<void> {
  await client.query(`DELETE FROM trades WHERE portfolio_id = $1`, [
    portfolioId,
  ]);
}
