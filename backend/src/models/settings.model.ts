import { pool } from "../config/database.js";
import type {
  PreferredExchange,
  PriceRefreshMs,
  UserSettings,
} from "../types/settings.js";

interface SettingsRow {
  user_id: string;
  price_refresh_ms: number;
  exchange: string;
  created_at: Date;
  updated_at: Date;
}

function mapSettings(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    priceRefreshMs: row.price_refresh_ms as PriceRefreshMs,
    exchange: row.exchange as PreferredExchange,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findSettingsByUserId(
  userId: string,
): Promise<UserSettings | null> {
  const result = await pool.query<SettingsRow>(
    `SELECT user_id, price_refresh_ms, exchange, created_at, updated_at
     FROM settings
     WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] ? mapSettings(result.rows[0]) : null;
}

export async function createSettings(
  userId: string,
  priceRefreshMs: PriceRefreshMs,
  exchange: PreferredExchange,
): Promise<UserSettings> {
  const result = await pool.query<SettingsRow>(
    `INSERT INTO settings (user_id, price_refresh_ms, exchange)
     VALUES ($1, $2, $3)
     RETURNING user_id, price_refresh_ms, exchange, created_at, updated_at`,
    [userId, priceRefreshMs, exchange],
  );

  return mapSettings(result.rows[0]);
}

export async function updateSettings(
  userId: string,
  priceRefreshMs: PriceRefreshMs,
  exchange: PreferredExchange,
): Promise<UserSettings> {
  const result = await pool.query<SettingsRow>(
    `UPDATE settings
     SET price_refresh_ms = $2,
         exchange = $3,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id, price_refresh_ms, exchange, created_at, updated_at`,
    [userId, priceRefreshMs, exchange],
  );

  return mapSettings(result.rows[0]);
}
