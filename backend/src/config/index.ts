import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load repo-root .env first, then backend-local overrides.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return parsed;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

function parseStartingCashBalance(value: string | undefined): number {
  const parsed = Number(value ?? 100_000);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid STARTING_CASH_BALANCE: ${value}`);
  }
  return parsed;
}

export const config = {
  port: parsePort(process.env.PORT, 3001),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: requireDatabaseUrl(),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  exchange: process.env.EXCHANGE ?? "gemini",
  geminiBaseUrl: process.env.GEMINI_BASE_URL ?? "https://api.gemini.com",
  geminiWsUrl: process.env.GEMINI_WS_URL ?? "wss://ws.gemini.com",
  jwtSecret: requireJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  startingCashBalance: parseStartingCashBalance(process.env.STARTING_CASH_BALANCE),
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
  isProd: process.env.NODE_ENV === "production",
} as const;

export type Config = typeof config;
