import type { PoolClient } from "pg";
import { pool } from "../config/database.js";
import type {
  PreferredExchange,
  PortfolioRecord,
} from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  starting_cash: string;
  cash_balance: string;
  exchange: string | null;
  is_default: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function mapPortfolio(row: PortfolioRow): PortfolioRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    startingCash: parseDecimal(row.starting_cash),
    cashBalance: parseDecimal(row.cash_balance),
    exchange: row.exchange as PreferredExchange | null,
    isDefault: row.is_default,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PORTFOLIO_SELECT = `id, user_id, name, starting_cash, cash_balance, exchange,
  is_default, archived_at, created_at, updated_at`;

export async function findPortfoliosByUserId(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<PortfolioRecord[]> {
  const includeArchived = options.includeArchived ?? false;
  const result = await pool.query<PortfolioRow>(
    `SELECT ${PORTFOLIO_SELECT}
     FROM portfolios
     WHERE user_id = $1
       AND ($2::boolean OR archived_at IS NULL)
     ORDER BY is_default DESC, created_at ASC`,
    [userId, includeArchived],
  );
  return result.rows.map(mapPortfolio);
}

export async function findPortfolioById(
  portfolioId: string,
): Promise<PortfolioRecord | null> {
  const result = await pool.query<PortfolioRow>(
    `SELECT ${PORTFOLIO_SELECT}
     FROM portfolios
     WHERE id = $1`,
    [portfolioId],
  );
  return result.rows[0] ? mapPortfolio(result.rows[0]) : null;
}

export async function findPortfolioForUser(
  portfolioId: string,
  userId: string,
): Promise<PortfolioRecord | null> {
  const result = await pool.query<PortfolioRow>(
    `SELECT ${PORTFOLIO_SELECT}
     FROM portfolios
     WHERE id = $1 AND user_id = $2`,
    [portfolioId, userId],
  );
  return result.rows[0] ? mapPortfolio(result.rows[0]) : null;
}

export async function findDefaultPortfolio(
  userId: string,
): Promise<PortfolioRecord | null> {
  const result = await pool.query<PortfolioRow>(
    `SELECT ${PORTFOLIO_SELECT}
     FROM portfolios
     WHERE user_id = $1 AND archived_at IS NULL
     ORDER BY is_default DESC, created_at ASC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? mapPortfolio(result.rows[0]) : null;
}

export async function createPortfolio(input: {
  userId: string;
  name: string;
  startingCash: number;
  exchange?: PreferredExchange | null;
  isDefault?: boolean;
}): Promise<PortfolioRecord> {
  const result = await pool.query<PortfolioRow>(
    `INSERT INTO portfolios (user_id, name, starting_cash, cash_balance, exchange, is_default)
     VALUES ($1, $2, $3, $3, $4, $5)
     RETURNING ${PORTFOLIO_SELECT}`,
    [
      input.userId,
      input.name,
      input.startingCash,
      input.exchange ?? null,
      input.isDefault ?? false,
    ],
  );
  return mapPortfolio(result.rows[0]);
}

export async function findPortfolioForUpdate(
  client: PoolClient,
  portfolioId: string,
): Promise<PortfolioRecord | null> {
  const result = await client.query<PortfolioRow>(
    `SELECT ${PORTFOLIO_SELECT}
     FROM portfolios
     WHERE id = $1
     FOR UPDATE`,
    [portfolioId],
  );
  return result.rows[0] ? mapPortfolio(result.rows[0]) : null;
}

export async function updatePortfolioCash(
  client: PoolClient,
  portfolioId: string,
  cashBalance: number,
): Promise<PortfolioRecord> {
  const result = await client.query<PortfolioRow>(
    `UPDATE portfolios
     SET cash_balance = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING ${PORTFOLIO_SELECT}`,
    [portfolioId, cashBalance],
  );
  return mapPortfolio(result.rows[0]);
}

export async function updatePortfolioMeta(
  portfolioId: string,
  input: {
    name?: string;
    exchange?: PreferredExchange | null;
  },
): Promise<PortfolioRecord> {
  const result = await pool.query<PortfolioRow>(
    `UPDATE portfolios
     SET
       name = COALESCE($2, name),
       exchange = CASE WHEN $3::boolean THEN $4 ELSE exchange END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING ${PORTFOLIO_SELECT}`,
    [
      portfolioId,
      input.name ?? null,
      input.exchange !== undefined,
      input.exchange === undefined ? null : input.exchange,
    ],
  );
  return mapPortfolio(result.rows[0]);
}

export async function archivePortfolio(
  portfolioId: string,
): Promise<PortfolioRecord> {
  const result = await pool.query<PortfolioRow>(
    `UPDATE portfolios
     SET archived_at = NOW(), is_default = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING ${PORTFOLIO_SELECT}`,
    [portfolioId],
  );
  return mapPortfolio(result.rows[0]);
}

export async function resetPortfolioBooks(
  client: PoolClient,
  portfolioId: string,
  startingCash: number,
): Promise<PortfolioRecord> {
  await client.query(`DELETE FROM trades WHERE portfolio_id = $1`, [portfolioId]);
  await client.query(`DELETE FROM positions WHERE portfolio_id = $1`, [
    portfolioId,
  ]);

  const result = await client.query<PortfolioRow>(
    `UPDATE portfolios
     SET cash_balance = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING ${PORTFOLIO_SELECT}`,
    [portfolioId, startingCash],
  );
  return mapPortfolio(result.rows[0]);
}
