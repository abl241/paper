/**
 * Request schemas. The backend parses every body and query with these before a
 * service sees it; the frontend can reuse them for form checks.
 *
 * Imported from "@paper/shared/schemas" so the main entry stays free of zod.
 */
import { z } from "zod";
import {
  BACKTEST_RANGES,
  CANDLE_INTERVALS,
  CLOCK_FORMAT_OPTIONS,
  EMAIL_PATTERN,
  EQUITY_RANGE_OPTIONS,
  EQUITY_RESOLUTION_OPTIONS,
  EQUITY_Y_AXIS_OPTIONS,
  EXCHANGE_OPTIONS,
  MAX_FEE_BPS,
  PASSWORD_MIN_LENGTH,
  PORTFOLIO_NAME_MAX_LENGTH,
  PRICE_REFRESH_OPTIONS,
  STRATEGY_NAME_MAX_LENGTH,
  STRATEGY_SOURCE_MAX_LENGTH,
  STRATEGY_TIMEFRAMES,
  TRADE_SIDES,
  TRADE_SOURCE_FILTERS,
  USERNAME_PATTERN,
} from "./constants.js";

const exchange = z.enum(EXCHANGE_OPTIONS);
const symbol = z.string().trim().min(1, "Symbol is required").max(32);
/** Money and quantities stay plain numbers on the wire; z.number() already rejects NaN and Infinity. */
const positiveNumber = z.number().positive();
const nonNegativeNumber = z.number().nonnegative();
/** Query strings only carry text, so numeric query params are coerced. */
const queryInt = (min: number) => z.coerce.number().int().min(min);

// --- Auth ---------------------------------------------------------------

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(
      USERNAME_PATTERN,
      "Username must be 3-50 characters and contain only letters, numbers, or underscores",
    ),
  email: z.string().trim().regex(EMAIL_PATTERN, "Invalid email address"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// --- Settings -----------------------------------------------------------

export const updateSettingsSchema = z.object({
  priceRefreshMs: z
    .number()
    .refine(
      (value): value is (typeof PRICE_REFRESH_OPTIONS)[number] =>
        (PRICE_REFRESH_OPTIONS as readonly number[]).includes(value),
      `Allowed: ${PRICE_REFRESH_OPTIONS.join(", ")}`,
    )
    .optional(),
  exchange: exchange.optional(),
  equityResolution: z.enum(EQUITY_RESOLUTION_OPTIONS).optional(),
  equityYAxis: z.enum(EQUITY_Y_AXIS_OPTIONS).optional(),
  equityDefaultRange: z.enum(EQUITY_RANGE_OPTIONS).optional(),
  clockFormat: z.enum(CLOCK_FORMAT_OPTIONS).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// --- Market data --------------------------------------------------------

export const exchangeQuerySchema = z.object({
  exchange: exchange.optional(),
});

export const summariesQuerySchema = exchangeQuerySchema.extend({
  quote: z.string().trim().min(1).optional(),
  symbols: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    )
    .optional(),
  limit: queryInt(1).optional(),
  offset: queryInt(0).optional(),
});

export const candlesQuerySchema = exchangeQuerySchema.extend({
  interval: z.enum(CANDLE_INTERVALS).default("1h"),
  history: z
    .string()
    .transform((value) => ["full", "max"].includes(value.toLowerCase()))
    .optional(),
});

// --- Portfolios ---------------------------------------------------------

const portfolioName = z
  .string()
  .trim()
  .min(1, `Portfolio name is required (max ${PORTFOLIO_NAME_MAX_LENGTH} characters)`)
  .max(PORTFOLIO_NAME_MAX_LENGTH, `Portfolio name is required (max ${PORTFOLIO_NAME_MAX_LENGTH} characters)`);

export const listPortfoliosQuerySchema = z.object({
  includeArchived: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const createPortfolioSchema = z.object({
  name: portfolioName,
  startingCash: nonNegativeNumber.optional(),
  exchange: exchange.nullable().optional(),
});
export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

export const updatePortfolioSchema = z.object({
  name: portfolioName.optional(),
  exchange: exchange.nullable().optional(),
});
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

export const fundsSchema = z.object({
  type: z.enum(["deposit", "withdraw"]),
  amount: positiveNumber,
  note: z.string().trim().max(200).optional(),
});
export type FundsInput = z.infer<typeof fundsSchema>;

export const orderSchema = z.object({
  symbol,
  quantity: positiveNumber,
});
export type OrderInput = z.infer<typeof orderSchema>;

export const tradesQuerySchema = z.object({
  symbol: symbol.optional(),
  side: z.enum(TRADE_SIDES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: z.enum(TRADE_SOURCE_FILTERS).optional(),
  strategyRunId: z.string().trim().min(1).optional(),
});

export const startStrategyRunSchema = z.object({
  strategyId: z.string().trim().min(1, "strategyId is required"),
  symbol: symbol.optional(),
  /** Default true: sells only close this run's own buys. */
  protectManualPositions: z.boolean().optional(),
});
export type StartStrategyRunInput = z.infer<typeof startStrategyRunSchema>;

// --- Watchlist ----------------------------------------------------------

export const addWatchlistItemSchema = z.object({ symbol });
export type AddWatchlistItemInput = z.infer<typeof addWatchlistItemSchema>;

// --- Strategies ---------------------------------------------------------

const strategyName = z
  .string()
  .trim()
  .min(1, `Strategy name is required (max ${STRATEGY_NAME_MAX_LENGTH} characters)`)
  .max(STRATEGY_NAME_MAX_LENGTH, `Strategy name is required (max ${STRATEGY_NAME_MAX_LENGTH} characters)`);

const strategyFields = {
  description: z.string().max(2_000).optional(),
  sourceCode: z.string().max(STRATEGY_SOURCE_MAX_LENGTH).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  symbols: z.array(symbol).max(20).optional(),
  exchange: exchange.nullable().optional(),
  timeframe: z.enum(STRATEGY_TIMEFRAMES).optional(),
  startingCapital: positiveNumber.optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  risk: z
    .object({
      maxPositionPct: nonNegativeNumber.optional(),
      stopLossPct: nonNegativeNumber.optional(),
      takeProfitPct: nonNegativeNumber.optional(),
      maxOpenPositions: z.number().int().nonnegative().optional(),
    })
    .optional(),
  notes: z.string().max(10_000).optional(),
};

export const createStrategySchema = z.object({
  /** Optional when a template supplies one. */
  name: strategyName.optional(),
  templateId: z.string().trim().min(1).optional(),
  ...strategyFields,
});
export type CreateStrategyInput = z.infer<typeof createStrategySchema>;

export const updateStrategySchema = z.object({
  name: strategyName.optional(),
  isFavorite: z.boolean().optional(),
  ...strategyFields,
});
export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>;

// --- Research -----------------------------------------------------------

export const createBacktestSchema = z.object({
  strategyId: z.string().trim().min(1, "strategyId is required"),
  symbol: symbol.optional(),
  range: z.enum(BACKTEST_RANGES).optional(),
  feeBps: z.number().min(0).max(MAX_FEE_BPS, `feeBps must be between 0 and ${MAX_FEE_BPS}`).optional(),
  exchange: exchange.nullable().optional(),
});
export type CreateBacktestInput = z.infer<typeof createBacktestSchema>;
