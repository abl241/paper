import { pool } from "../config/database.js";
import type {
  BacktestEquityPoint,
  BacktestStats,
  BacktestTrade,
} from "../services/research/backtest.engine.js";
import type { PreferredExchange } from "../types/settings.js";
import type { StrategyTimeframe } from "../types/strategy.js";
import type {
  BacktestRange,
  BacktestRecord,
  BacktestStatus,
} from "../types/research.js";
import { parseDecimal } from "../utils/decimal.js";

interface BacktestRow {
  id: string;
  user_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  exchange: string | null;
  range_label: string;
  starting_capital: string;
  fee_bps: string;
  status: BacktestStatus;
  stats: BacktestStats | string;
  equity_curve: BacktestEquityPoint[] | string;
  trades: BacktestTrade[] | string;
  logs: string[] | string;
  notes: string[];
  error: string | null;
  created_at: Date;
}

function parseJsonField<T>(value: T | string, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value ?? fallback;
}

export function mapBacktest(row: BacktestRow): BacktestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    symbol: row.symbol,
    timeframe: row.timeframe as StrategyTimeframe,
    exchange: row.exchange as PreferredExchange | null,
    rangeLabel: row.range_label as BacktestRange,
    startingCapital: parseDecimal(row.starting_capital),
    feeBps: parseDecimal(row.fee_bps),
    status: row.status,
    stats: parseJsonField(row.stats, {
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      tradeCount: 0,
      winRate: 0,
      endingEquity: 0,
      startingCapital: 0,
    }),
    equityCurve: parseJsonField(row.equity_curve, []),
    trades: parseJsonField(row.trades, []),
    logs: parseJsonField(row.logs, []),
    notes: row.notes ?? [],
    error: row.error,
    createdAt: row.created_at,
  };
}

const BACKTEST_SELECT = `id, user_id, strategy_id, strategy_name, symbol, timeframe,
  exchange, range_label, starting_capital, fee_bps, status, stats, equity_curve,
  trades, logs, notes, error, created_at`;

export async function insertBacktest(input: {
  userId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  rangeLabel: BacktestRange;
  startingCapital: number;
  feeBps: number;
  status: BacktestStatus;
  stats: BacktestStats;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  logs: string[];
  notes: string[];
  error: string | null;
}): Promise<BacktestRecord> {
  const result = await pool.query<BacktestRow>(
    `INSERT INTO backtests (
       user_id, strategy_id, strategy_name, symbol, timeframe, exchange,
       range_label, starting_capital, fee_bps, status, stats, equity_curve,
       trades, logs, notes, error
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16
     )
     RETURNING ${BACKTEST_SELECT}`,
    [
      input.userId,
      input.strategyId,
      input.strategyName,
      input.symbol,
      input.timeframe,
      input.exchange,
      input.rangeLabel,
      input.startingCapital,
      input.feeBps,
      input.status,
      JSON.stringify(input.stats),
      JSON.stringify(input.equityCurve),
      JSON.stringify(input.trades),
      JSON.stringify(input.logs),
      input.notes,
      input.error,
    ],
  );
  return mapBacktest(result.rows[0]);
}

export async function findBacktestsByUserId(
  userId: string,
  limit = 30,
): Promise<BacktestRecord[]> {
  const result = await pool.query<BacktestRow>(
    `SELECT ${BACKTEST_SELECT}
     FROM backtests
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map(mapBacktest);
}

export async function findBacktestForUser(
  backtestId: string,
  userId: string,
): Promise<BacktestRecord | null> {
  const result = await pool.query<BacktestRow>(
    `SELECT ${BACKTEST_SELECT}
     FROM backtests
     WHERE id = $1 AND user_id = $2`,
    [backtestId, userId],
  );
  return result.rows[0] ? mapBacktest(result.rows[0]) : null;
}
