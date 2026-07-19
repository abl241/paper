import { pool } from "../config/database.js";
import type { PreferredExchange } from "../types/settings.js";
import type {
  StrategyMessage,
  StrategyParams,
  StrategyRecord,
  StrategyRiskConfig,
  StrategyTimeframe,
  StrategyValidationStatus,
} from "../types/strategy.js";
import { parseDecimal } from "../utils/decimal.js";

interface StrategyRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  source_code: string;
  tags: string[];
  is_favorite: boolean;
  validation_status: StrategyValidationStatus;
  validation_messages: StrategyMessage[] | string;
  symbols: string[];
  exchange: string | null;
  timeframe: string;
  starting_capital: string;
  params: StrategyParams | string;
  risk: StrategyRiskConfig | string;
  notes: string;
  created_at: Date;
  updated_at: Date;
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

export function mapStrategy(row: StrategyRow): StrategyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    sourceCode: row.source_code,
    tags: row.tags ?? [],
    isFavorite: row.is_favorite,
    validationStatus: row.validation_status,
    validationMessages: parseJsonField(row.validation_messages, []),
    symbols: row.symbols ?? [],
    exchange: row.exchange as PreferredExchange | null,
    timeframe: row.timeframe as StrategyTimeframe,
    startingCapital: parseDecimal(row.starting_capital),
    params: parseJsonField(row.params, {}),
    risk: parseJsonField(row.risk, {}),
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const STRATEGY_SELECT = `id, user_id, name, description, source_code, tags, is_favorite,
  validation_status, validation_messages, symbols, exchange, timeframe,
  starting_capital, params, risk, notes, created_at, updated_at`;

export async function findStrategiesByUserId(
  userId: string,
): Promise<StrategyRecord[]> {
  const result = await pool.query<StrategyRow>(
    `SELECT ${STRATEGY_SELECT}
     FROM strategies
     WHERE user_id = $1
     ORDER BY is_favorite DESC, updated_at DESC`,
    [userId],
  );
  return result.rows.map(mapStrategy);
}

export async function findStrategyForUser(
  strategyId: string,
  userId: string,
): Promise<StrategyRecord | null> {
  const result = await pool.query<StrategyRow>(
    `SELECT ${STRATEGY_SELECT}
     FROM strategies
     WHERE id = $1 AND user_id = $2`,
    [strategyId, userId],
  );
  return result.rows[0] ? mapStrategy(result.rows[0]) : null;
}

export async function createStrategy(input: {
  userId: string;
  name: string;
  description: string;
  sourceCode: string;
  tags: string[];
  symbols: string[];
  exchange: PreferredExchange | null;
  timeframe: StrategyTimeframe;
  startingCapital: number;
  params: StrategyParams;
  risk: StrategyRiskConfig;
  notes: string;
}): Promise<StrategyRecord> {
  const result = await pool.query<StrategyRow>(
    `INSERT INTO strategies (
       user_id, name, description, source_code, tags, symbols, exchange,
       timeframe, starting_capital, params, risk, notes
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12
     )
     RETURNING ${STRATEGY_SELECT}`,
    [
      input.userId,
      input.name,
      input.description,
      input.sourceCode,
      input.tags,
      input.symbols,
      input.exchange,
      input.timeframe,
      input.startingCapital,
      JSON.stringify(input.params),
      JSON.stringify(input.risk),
      input.notes,
    ],
  );
  return mapStrategy(result.rows[0]);
}

export async function updateStrategy(
  strategyId: string,
  userId: string,
  patch: {
    name?: string;
    description?: string;
    sourceCode?: string;
    tags?: string[];
    isFavorite?: boolean;
    symbols?: string[];
    exchange?: PreferredExchange | null;
    timeframe?: StrategyTimeframe;
    startingCapital?: number;
    params?: StrategyParams;
    risk?: StrategyRiskConfig;
    notes?: string;
    validationStatus?: StrategyValidationStatus;
    validationMessages?: StrategyMessage[];
  },
): Promise<StrategyRecord | null> {
  const result = await pool.query<StrategyRow>(
    `UPDATE strategies SET
       name = COALESCE($3, name),
       description = COALESCE($4, description),
       source_code = COALESCE($5, source_code),
       tags = COALESCE($6, tags),
       is_favorite = COALESCE($7, is_favorite),
       symbols = COALESCE($8, symbols),
       exchange = CASE WHEN $9::boolean THEN $10 ELSE exchange END,
       timeframe = COALESCE($11, timeframe),
       starting_capital = COALESCE($12, starting_capital),
       params = COALESCE($13::jsonb, params),
       risk = COALESCE($14::jsonb, risk),
       notes = COALESCE($15, notes),
       validation_status = COALESCE($16, validation_status),
       validation_messages = COALESCE($17::jsonb, validation_messages),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING ${STRATEGY_SELECT}`,
    [
      strategyId,
      userId,
      patch.name ?? null,
      patch.description ?? null,
      patch.sourceCode ?? null,
      patch.tags ?? null,
      patch.isFavorite ?? null,
      patch.symbols ?? null,
      Object.prototype.hasOwnProperty.call(patch, "exchange"),
      patch.exchange ?? null,
      patch.timeframe ?? null,
      patch.startingCapital ?? null,
      patch.params !== undefined ? JSON.stringify(patch.params) : null,
      patch.risk !== undefined ? JSON.stringify(patch.risk) : null,
      patch.notes ?? null,
      patch.validationStatus ?? null,
      patch.validationMessages !== undefined
        ? JSON.stringify(patch.validationMessages)
        : null,
    ],
  );
  return result.rows[0] ? mapStrategy(result.rows[0]) : null;
}

export async function deleteStrategy(
  strategyId: string,
  userId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM strategies WHERE id = $1 AND user_id = $2`,
    [strategyId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
