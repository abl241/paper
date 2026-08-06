import { pool } from "../config/database.js";
import type { PreferredExchange } from "../types/settings.js";
import type { StrategyTimeframe } from "../types/strategy.js";
import type {
  StrategyRunRecord,
  StrategyRunStatus,
} from "../types/strategyRun.js";

interface StrategyRunRow {
  id: string;
  user_id: string;
  portfolio_id: string;
  strategy_id: string;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  exchange: string | null;
  status: StrategyRunStatus;
  last_processed_bar_time: Date | null;
  last_heartbeat_at: Date | null;
  last_error: string | null;
  logs: string[] | string;
  created_at: Date;
  updated_at: Date;
}

function parseLogs(value: string[] | string): string[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return value ?? [];
}

export function mapStrategyRun(row: StrategyRunRow): StrategyRunRecord {
  return {
    id: row.id,
    userId: row.user_id,
    portfolioId: row.portfolio_id,
    strategyId: row.strategy_id,
    strategyName: row.strategy_name,
    symbol: row.symbol,
    timeframe: row.timeframe as StrategyTimeframe,
    exchange: row.exchange as PreferredExchange | null,
    status: row.status,
    lastProcessedBarTime: row.last_processed_bar_time,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastError: row.last_error,
    logs: parseLogs(row.logs),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RUN_SELECT = `id, user_id, portfolio_id, strategy_id, strategy_name, symbol,
  timeframe, exchange, status, last_processed_bar_time, last_heartbeat_at,
  last_error, logs, created_at, updated_at`;

export async function findRunningStrategyRun(
  portfolioId: string,
  userId: string,
): Promise<StrategyRunRecord | null> {
  const result = await pool.query<StrategyRunRow>(
    `SELECT ${RUN_SELECT}
     FROM strategy_runs
     WHERE portfolio_id = $1 AND user_id = $2 AND status = 'running'
     LIMIT 1`,
    [portfolioId, userId],
  );
  return result.rows[0] ? mapStrategyRun(result.rows[0]) : null;
}

export async function findLatestStrategyRun(
  portfolioId: string,
  userId: string,
): Promise<StrategyRunRecord | null> {
  const result = await pool.query<StrategyRunRow>(
    `SELECT ${RUN_SELECT}
     FROM strategy_runs
     WHERE portfolio_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [portfolioId, userId],
  );
  return result.rows[0] ? mapStrategyRun(result.rows[0]) : null;
}

export async function insertStrategyRun(input: {
  userId: string;
  portfolioId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  lastProcessedBarTime: Date | null;
  lastHeartbeatAt: Date | null;
  logs: string[];
}): Promise<StrategyRunRecord> {
  const result = await pool.query<StrategyRunRow>(
    `INSERT INTO strategy_runs (
       user_id, portfolio_id, strategy_id, strategy_name, symbol, timeframe,
       exchange, status, last_processed_bar_time, last_heartbeat_at, logs
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, 'running', $8, $9, $10::jsonb
     )
     RETURNING ${RUN_SELECT}`,
    [
      input.userId,
      input.portfolioId,
      input.strategyId,
      input.strategyName,
      input.symbol,
      input.timeframe,
      input.exchange,
      input.lastProcessedBarTime,
      input.lastHeartbeatAt,
      JSON.stringify(input.logs),
    ],
  );
  return mapStrategyRun(result.rows[0]);
}

export async function stopStrategyRun(
  runId: string,
  userId: string,
): Promise<StrategyRunRecord | null> {
  const result = await pool.query<StrategyRunRow>(
    `UPDATE strategy_runs SET
       status = 'stopped',
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'running'
     RETURNING ${RUN_SELECT}`,
    [runId, userId],
  );
  return result.rows[0] ? mapStrategyRun(result.rows[0]) : null;
}

export async function stopRunningStrategyRunForPortfolio(
  portfolioId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `UPDATE strategy_runs SET
       status = 'stopped',
       updated_at = NOW()
     WHERE portfolio_id = $1 AND user_id = $2 AND status = 'running'`,
    [portfolioId, userId],
  );
}

export async function updateStrategyRunState(
  runId: string,
  userId: string,
  patch: {
    lastProcessedBarTime?: Date | null;
    lastHeartbeatAt?: Date | null;
    lastError?: string | null;
    logs?: string[];
  },
): Promise<StrategyRunRecord | null> {
  const result = await pool.query<StrategyRunRow>(
    `UPDATE strategy_runs SET
       last_processed_bar_time = CASE
         WHEN $3::boolean THEN $4
         ELSE last_processed_bar_time
       END,
       last_heartbeat_at = CASE
         WHEN $5::boolean THEN $6
         ELSE last_heartbeat_at
       END,
       last_error = CASE
         WHEN $7::boolean THEN $8
         ELSE last_error
       END,
       logs = CASE
         WHEN $9::boolean THEN $10::jsonb
         ELSE logs
       END,
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${RUN_SELECT}`,
    [
      runId,
      userId,
      Object.prototype.hasOwnProperty.call(patch, "lastProcessedBarTime"),
      patch.lastProcessedBarTime ?? null,
      Object.prototype.hasOwnProperty.call(patch, "lastHeartbeatAt"),
      patch.lastHeartbeatAt ?? null,
      Object.prototype.hasOwnProperty.call(patch, "lastError"),
      patch.lastError ?? null,
      Object.prototype.hasOwnProperty.call(patch, "logs"),
      patch.logs !== undefined ? JSON.stringify(patch.logs) : null,
    ],
  );
  return result.rows[0] ? mapStrategyRun(result.rows[0]) : null;
}
