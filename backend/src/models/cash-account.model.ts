import { pool } from "../config/database.js";
import type { CashAccount } from "../types/portfolio.js";
import { parseDecimal } from "../utils/decimal.js";

interface CashAccountRow {
  user_id: string;
  balance: string;
  created_at: Date;
  updated_at: Date;
}

function mapCashAccount(row: CashAccountRow): CashAccount {
  return {
    userId: row.user_id,
    balance: parseDecimal(row.balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findCashAccountByUserId(
  userId: string,
): Promise<CashAccount | null> {
  const result = await pool.query<CashAccountRow>(
    `SELECT user_id, balance, created_at, updated_at
     FROM cash_accounts
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] ? mapCashAccount(result.rows[0]) : null;
}

export async function createCashAccount(
  userId: string,
  balance: number,
): Promise<CashAccount> {
  const result = await pool.query<CashAccountRow>(
    `INSERT INTO cash_accounts (user_id, balance)
     VALUES ($1, $2)
     RETURNING user_id, balance, created_at, updated_at`,
    [userId, balance],
  );

  return mapCashAccount(result.rows[0]);
}
