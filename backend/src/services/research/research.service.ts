import {
  findBacktestForUser,
  findBacktestsByUserId,
  insertBacktest,
} from "../../models/backtest.model.js";
import { findStrategyForUser } from "../../models/strategy.model.js";
import { AppError } from "../../types/api.js";
import { EXCHANGE_OPTIONS, type PreferredExchange } from "../../types/settings.js";
import type {
  BacktestDetail,
  BacktestRange,
  BacktestRecord,
  BacktestSummary,
  CreateBacktestInput,
} from "../../types/research.js";
import { marketService } from "../market/market.service.js";
import { settingsService } from "../settings/settings.service.js";
import { compileStrategy } from "../strategy/runtime.js";
import { runBacktest } from "./backtest.engine.js";
import {
  BACKTEST_RANGES,
  filterBarsByRange,
  resolveBacktestInterval,
} from "./candleInterval.js";

function toSummary(record: BacktestRecord): BacktestSummary {
  return {
    id: record.id,
    strategyId: record.strategyId,
    strategyName: record.strategyName,
    symbol: record.symbol,
    timeframe: record.timeframe,
    rangeLabel: record.rangeLabel,
    status: record.status,
    stats: record.stats,
    createdAt: record.createdAt.toISOString(),
  };
}

function toDetail(record: BacktestRecord): BacktestDetail {
  return {
    id: record.id,
    strategyId: record.strategyId,
    strategyName: record.strategyName,
    symbol: record.symbol,
    timeframe: record.timeframe,
    exchange: record.exchange,
    rangeLabel: record.rangeLabel,
    startingCapital: record.startingCapital,
    feeBps: record.feeBps,
    status: record.status,
    stats: record.stats,
    equityCurve: record.equityCurve,
    trades: record.trades,
    logs: record.logs,
    notes: record.notes,
    error: record.error,
    createdAt: record.createdAt.toISOString(),
  };
}

function normalizeRange(value: string | undefined): BacktestRange {
  if (!value) return "30d";
  if (!(BACKTEST_RANGES as readonly string[]).includes(value)) {
    throw new AppError(
      `Invalid range. Supported: ${BACKTEST_RANGES.join(", ")}`,
      400,
      "INVALID_RANGE",
    );
  }
  return value as BacktestRange;
}

function normalizeExchange(
  value: string | null | undefined,
): PreferredExchange | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!(EXCHANGE_OPTIONS as readonly string[]).includes(value)) {
    throw new AppError("Invalid exchange", 400, "INVALID_EXCHANGE");
  }
  return value as PreferredExchange;
}

export class ResearchService {
  async listBacktests(userId: string): Promise<BacktestSummary[]> {
    const rows = await findBacktestsByUserId(userId);
    return rows.map(toSummary);
  }

  async getBacktest(userId: string, backtestId: string): Promise<BacktestDetail> {
    const row = await findBacktestForUser(backtestId, userId);
    if (!row) {
      throw new AppError("Backtest not found", 404, "BACKTEST_NOT_FOUND");
    }
    return toDetail(row);
  }

  async runBacktest(
    userId: string,
    input: CreateBacktestInput,
  ): Promise<BacktestDetail> {
    const strategy = await findStrategyForUser(input.strategyId, userId);
    if (!strategy) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    const symbol = (
      input.symbol?.trim() ||
      strategy.symbols[0] ||
      "BTC-USD"
    ).toUpperCase();

    const range = normalizeRange(input.range);
    const feeBps =
      input.feeBps !== undefined
        ? input.feeBps
        : 0;
    if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 1000) {
      throw new AppError("feeBps must be between 0 and 1000", 400, "INVALID_FEE");
    }

    const settings = await settingsService.getSettings(userId);
    const exchangeOverride = normalizeExchange(input.exchange);
    const exchange: PreferredExchange =
      exchangeOverride ??
      strategy.exchange ??
      settings.exchange;

    const notes: string[] = [];
    if (strategy.validationStatus !== "valid") {
      notes.push(
        `Strategy validation status is "${strategy.validationStatus}" — run may be unreliable`,
      );
    }

    const { interval, note } = resolveBacktestInterval(
      strategy.timeframe,
      exchange,
    );
    if (note) notes.push(note);

    const compiled = compileStrategy(strategy.sourceCode);
    if (!compiled.ok) {
      const error = compiled.messages
        .filter((m) => m.level === "error")
        .map((m) => m.message)
        .join("; ");
      const failed = await insertBacktest({
        userId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol,
        timeframe: strategy.timeframe,
        exchange,
        rangeLabel: range,
        startingCapital: strategy.startingCapital,
        feeBps,
        status: "failed",
        stats: {
          totalReturnPct: 0,
          maxDrawdownPct: 0,
          tradeCount: 0,
          winRate: 0,
          endingEquity: strategy.startingCapital,
          startingCapital: strategy.startingCapital,
        },
        equityCurve: [],
        trades: [],
        logs: [],
        notes,
        error: error || "Strategy compile failed",
      });
      return toDetail(failed);
    }

    notes.push(...compiled.warnings.map((w) => w.message));

    let candles;
    try {
      candles = await marketService.getCandles(symbol, interval, exchange);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch candles";
      throw new AppError(message, 400, "CANDLE_FETCH_FAILED");
    }

    const sorted = [...candles].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const bars = filterBarsByRange(
      sorted.map((candle) => ({
        time: Math.floor(candle.timestamp.getTime() / 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      })),
      range,
    );

    if (bars.length < 2) {
      throw new AppError(
        "Not enough candle data for this symbol/timeframe/range",
        400,
        "INSUFFICIENT_CANDLES",
      );
    }

    notes.push(`Loaded ${bars.length} bars (${interval})`);

    let result;
    try {
      result = runBacktest({
        strategy: compiled.strategy,
        params: strategy.params,
        bars,
        symbol,
        startingCapital: strategy.startingCapital,
        feeBps,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Backtest runtime error";
      const failed = await insertBacktest({
        userId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol,
        timeframe: strategy.timeframe,
        exchange,
        rangeLabel: range,
        startingCapital: strategy.startingCapital,
        feeBps,
        status: "failed",
        stats: {
          totalReturnPct: 0,
          maxDrawdownPct: 0,
          tradeCount: 0,
          winRate: 0,
          endingEquity: strategy.startingCapital,
          startingCapital: strategy.startingCapital,
        },
        equityCurve: [],
        trades: [],
        logs: [],
        notes,
        error: message,
      });
      return toDetail(failed);
    }

    const saved = await insertBacktest({
      userId,
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol,
      timeframe: strategy.timeframe,
      exchange,
      rangeLabel: range,
      startingCapital: strategy.startingCapital,
      feeBps,
      status: "completed",
      stats: result.stats,
      equityCurve: result.equityCurve,
      trades: result.trades,
      logs: result.logs,
      notes,
      error: null,
    });

    return toDetail(saved);
  }
}

export const researchService = new ResearchService();
