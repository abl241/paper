import type { PoolClient } from "pg";
import { pool } from "../config/database.js";
import type { CashLedgerEntry } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface LedgerRow {
  id: string;
  portfolio_id: string;
  type: "deposit" | "withdraw" | "reset";
  amount: string;
  balance_after: string;
  note: string | null;
  created_at: Date;
}

function mapLedger(row: LedgerRow): CashLedgerEntry {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    type: row.type,
    amount: parseDecimal(row.amount),
    balanceAfter: parseDecimal(row.balance_after),
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function insertCashLedger(
  client: PoolClient,
  input: {
    portfolioId: string;
    type: "deposit" | "withdraw" | "reset";
    amount: number;
    balanceAfter: number;
    note?: string | null;
  },
): Promise<CashLedgerEntry> {
  const result = await client.query<LedgerRow>(
    `INSERT INTO cash_ledger (portfolio_id, type, amount, balance_after, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, portfolio_id, type, amount, balance_after, note, created_at`,
    [
      input.portfolioId,
      input.type,
      input.amount,
      input.balanceAfter,
      input.note ?? null,
    ],
  );
  return mapLedger(result.rows[0]);
}

export async function findLedgerByPortfolioId(
  portfolioId: string,
): Promise<CashLedgerEntry[]> {
  const result = await pool.query<LedgerRow>(
    `SELECT id, portfolio_id, type, amount, balance_after, note, created_at
     FROM cash_ledger
     WHERE portfolio_id = $1
     ORDER BY created_at DESC`,
    [portfolioId],
  );
  return result.rows.map(mapLedger);
}
