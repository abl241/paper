import { pool } from "../config/database.js";
import type {
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
  UserSettings,
} from "../types/settings.js";

interface SettingsRow {
  user_id: string;
  price_refresh_ms: number;
  exchange: string;
  equity_resolution: string;
  equity_y_axis: string;
  equity_default_range: string;
  clock_format: string;
  created_at: Date;
  updated_at: Date;
}

function mapSettings(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    priceRefreshMs: row.price_refresh_ms as PriceRefreshMs,
    exchange: row.exchange as PreferredExchange,
    equityResolution: row.equity_resolution as EquityResolution,
    equityYAxis: row.equity_y_axis as EquityYAxis,
    equityDefaultRange: row.equity_default_range as EquityDefaultRange,
    clockFormat: row.clock_format as ClockFormat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = `user_id, price_refresh_ms, exchange, equity_resolution,
  equity_y_axis, equity_default_range, clock_format, created_at, updated_at`;

export async function findSettingsByUserId(
  userId: string,
): Promise<UserSettings | null> {
  const result = await pool.query<SettingsRow>(
    `SELECT ${SELECT_COLS}
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
  equityResolution: EquityResolution,
  equityYAxis: EquityYAxis,
  equityDefaultRange: EquityDefaultRange,
  clockFormat: ClockFormat,
): Promise<UserSettings> {
  const result = await pool.query<SettingsRow>(
    `INSERT INTO settings (
       user_id, price_refresh_ms, exchange,
       equity_resolution, equity_y_axis, equity_default_range, clock_format
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLS}`,
    [
      userId,
      priceRefreshMs,
      exchange,
      equityResolution,
      equityYAxis,
      equityDefaultRange,
      clockFormat,
    ],
  );

  return mapSettings(result.rows[0]);
}

export async function updateSettings(
  userId: string,
  priceRefreshMs: PriceRefreshMs,
  exchange: PreferredExchange,
  equityResolution: EquityResolution,
  equityYAxis: EquityYAxis,
  equityDefaultRange: EquityDefaultRange,
  clockFormat: ClockFormat,
): Promise<UserSettings> {
  const result = await pool.query<SettingsRow>(
    `UPDATE settings
     SET price_refresh_ms = $2,
         exchange = $3,
         equity_resolution = $4,
         equity_y_axis = $5,
         equity_default_range = $6,
         clock_format = $7,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING ${SELECT_COLS}`,
    [
      userId,
      priceRefreshMs,
      exchange,
      equityResolution,
      equityYAxis,
      equityDefaultRange,
      clockFormat,
    ],
  );

  return mapSettings(result.rows[0]);
}
