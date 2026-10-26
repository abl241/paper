import type { PoolClient } from "pg";
import { pool, type Queryable } from "../config/database.js";
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
  strategy_run_id: string | null;
}

const TRADE_SELECT = `id, portfolio_id, symbol, side, quantity, execution_price,
  realized_pnl, executed_at, strategy_run_id`;

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
    strategyRunId: row.strategy_run_id,
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
    strategyRunId?: string | null;
    executedAt?: Date;
  },
): Promise<Trade> {
  const result = await client.query<TradeRow>(
    input.executedAt
      ? `INSERT INTO trades (
           portfolio_id, symbol, side, quantity, execution_price, realized_pnl,
           strategy_run_id, executed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${TRADE_SELECT}`
      : `INSERT INTO trades (
           portfolio_id, symbol, side, quantity, execution_price, realized_pnl,
           strategy_run_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${TRADE_SELECT}`,
    input.executedAt
      ? [
          input.portfolioId,
          input.symbol,
          input.side,
          input.quantity,
          input.executionPrice,
          input.realizedPnL,
          input.strategyRunId ?? null,
          input.executedAt,
        ]
      : [
          input.portfolioId,
          input.symbol,
          input.side,
          input.quantity,
          input.executionPrice,
          input.realizedPnL,
          input.strategyRunId ?? null,
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
  if (filters.strategyRunId) {
    params.push(filters.strategyRunId);
    clauses.push(`strategy_run_id = $${params.length}`);
  } else if (filters.source === "strategy") {
    clauses.push(`strategy_run_id IS NOT NULL`);
  } else if (filters.source === "manual") {
    clauses.push(`strategy_run_id IS NULL`);
  }

  const result = await pool.query<TradeRow>(
    `SELECT ${TRADE_SELECT}
     FROM trades
     WHERE ${clauses.join(" AND ")}
     ORDER BY executed_at DESC, seq DESC`,
    params,
  );

  return result.rows.map(mapTrade);
}

export async function findTradesByStrategyRunId(
  strategyRunId: string,
  db: Queryable = pool,
): Promise<Trade[]> {
  const result = await db.query<TradeRow>(
    `SELECT ${TRADE_SELECT}
     FROM trades
     WHERE strategy_run_id = $1
     ORDER BY executed_at DESC, seq DESC`,
    [strategyRunId],
  );
  return result.rows.map(mapTrade);
}

export async function findTradesChronological(
  portfolioId: string,
): Promise<Trade[]> {
  const result = await pool.query<TradeRow>(
    `SELECT ${TRADE_SELECT}
     FROM trades
     WHERE portfolio_id = $1
     ORDER BY executed_at ASC, seq ASC`,
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
