import {
  findLatestStrategyRun,
  findRunningStrategyRun,
  insertStrategyRun,
  stopRunningStrategyRunForPortfolio,
  stopStrategyRun,
  updateStrategyRunState,
} from "../../models/strategy-run.model.js";
import { findStrategyForUser } from "../../models/strategy.model.js";
import { findPositionsByPortfolioId } from "../../models/position.model.js";
import { AppError } from "../../types/api.js";
import type { PreferredExchange } from "../../types/settings.js";
import type {
  StartStrategyRunInput,
  StrategyRunPresence,
  StrategyRunRecord,
  StrategyRunView,
} from "../../types/strategyRun.js";
import { normalizeSymbol } from "../../utils/symbols.js";
import { marketService } from "../market/market.service.js";
import { portfolioService } from "../portfolio/portfolio.service.js";
import { resolveBacktestInterval } from "../research/candleInterval.js";
import { tradingService } from "../trading/trading.service.js";
import {
  compileStrategy,
  createIndicators,
  type OrderIntent,
  type StrategyBar,
  type StrategyFn,
  type StrategyParams,
} from "./runtime.js";

const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const MAX_LOGS = 200;
const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "6h": 21_600,
  "1d": 86_400,
};

function toView(run: StrategyRunRecord): StrategyRunView {
  return {
    id: run.id,
    portfolioId: run.portfolioId,
    strategyId: run.strategyId,
    strategyName: run.strategyName,
    symbol: run.symbol,
    timeframe: run.timeframe,
    exchange: run.exchange,
    status: run.status,
    presence: derivePresence(run),
    lastProcessedBarTime: run.lastProcessedBarTime?.toISOString() ?? null,
    lastHeartbeatAt: run.lastHeartbeatAt?.toISOString() ?? null,
    lastError: run.lastError,
    logs: run.logs,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function derivePresence(run: StrategyRunRecord): StrategyRunPresence {
  if (run.status !== "running") return "stopped";
  if (!run.lastHeartbeatAt) return "idle";
  const age = Date.now() - run.lastHeartbeatAt.getTime();
  return age <= HEARTBEAT_STALE_MS ? "active" : "idle";
}

function pushLog(logs: string[], message: string): string[] {
  const next = [...logs, message];
  if (next.length <= MAX_LOGS) return next;
  return next.slice(next.length - MAX_LOGS);
}

function resolveBuyQty(
  intent: OrderIntent,
  cash: number,
  equity: number,
  price: number,
): number {
  if (intent.quantity !== undefined && Number.isFinite(intent.quantity)) {
    return Math.max(0, intent.quantity);
  }
  if (
    intent.fractionOfEquity !== undefined &&
    Number.isFinite(intent.fractionOfEquity)
  ) {
    return Math.max(0, (equity * intent.fractionOfEquity) / price);
  }
  if (
    intent.fractionOfCash !== undefined &&
    Number.isFinite(intent.fractionOfCash)
  ) {
    return Math.max(0, (cash * intent.fractionOfCash) / price);
  }
  return Math.max(0, cash / price / 10);
}

function intervalSeconds(interval: string): number {
  return INTERVAL_SECONDS[interval.toLowerCase()] ?? 3600;
}

function isBarClosed(bar: StrategyBar, interval: string, nowSec: number): boolean {
  return bar.time + intervalSeconds(interval) <= nowSec;
}

function candlesToBars(
  candles: { timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[],
): StrategyBar[] {
  return [...candles]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((candle) => ({
      time: Math.floor(candle.timestamp.getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));
}

export class LiveRunnerService {
  async getActive(
    userId: string,
    portfolioId: string,
  ): Promise<StrategyRunView | null> {
    await portfolioService.requireOwnedPortfolio(userId, portfolioId, {
      allowArchived: true,
    });
    const running = await findRunningStrategyRun(portfolioId, userId);
    if (running) return toView(running);
    const latest = await findLatestStrategyRun(portfolioId, userId);
    return latest ? toView(latest) : null;
  }

  async start(
    userId: string,
    portfolioId: string,
    input: StartStrategyRunInput,
  ): Promise<StrategyRunView> {
    const portfolio = await portfolioService.requireOwnedPortfolio(
      userId,
      portfolioId,
    );

    if (!input.strategyId || typeof input.strategyId !== "string") {
      throw new AppError("strategyId is required", 400, "INVALID_INPUT");
    }

    const strategy = await findStrategyForUser(input.strategyId, userId);
    if (!strategy) {
      throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
    }

    let symbol: string;
    try {
      symbol = normalizeSymbol(
        input.symbol?.trim() || strategy.symbols[0] || "BTC-USD",
      );
    } catch {
      throw new AppError("Invalid symbol", 400, "INVALID_SYMBOL");
    }

    const exchange = (await portfolioService.resolveExchange(
      userId,
      portfolio,
    )) as PreferredExchange;

    const { interval, note } = resolveBacktestInterval(
      strategy.timeframe,
      exchange,
    );

    const compiled = compileStrategy(strategy.sourceCode);
    if (!compiled.ok) {
      const detail = compiled.messages
        .filter((m) => m.level === "error")
        .map((m) => m.message)
        .join("; ");
      throw new AppError(
        detail || "Strategy compile failed",
        400,
        "STRATEGY_COMPILE_FAILED",
      );
    }

    let candles;
    try {
      candles = await marketService.getCandles(symbol, interval, exchange);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch candles";
      throw new AppError(message, 400, "CANDLE_FETCH_FAILED");
    }

    const bars = candlesToBars(candles);
    const nowSec = Math.floor(Date.now() / 1000);
    const closed = bars.filter((bar) => isBarClosed(bar, interval, nowSec));
    if (closed.length < 2) {
      throw new AppError(
        "Not enough closed candle data to arm this run",
        400,
        "INSUFFICIENT_CANDLES",
      );
    }

    // Arm at latest closed bar — do not replay history on start.
    const lastClosed = closed[closed.length - 1];
    const lastProcessed = new Date(lastClosed.time * 1000);
    const now = new Date();

    let logs = [
      `Armed ${strategy.name} on ${symbol} (${strategy.timeframe} → ${interval})`,
      `Baseline bar ${lastProcessed.toISOString()} — waiting for new closed bars`,
    ];
    if (note) logs = pushLog(logs, note);
    if (strategy.validationStatus !== "valid") {
      logs = pushLog(
        logs,
        `Strategy validation is "${strategy.validationStatus}" — run may be unreliable`,
      );
    }

    await stopRunningStrategyRunForPortfolio(portfolioId, userId);

    const run = await insertStrategyRun({
      userId,
      portfolioId,
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol,
      timeframe: strategy.timeframe,
      exchange,
      lastProcessedBarTime: lastProcessed,
      lastHeartbeatAt: now,
      logs,
    });

    return toView(run);
  }

  async stop(
    userId: string,
    portfolioId: string,
  ): Promise<StrategyRunView | null> {
    await portfolioService.requireOwnedPortfolio(userId, portfolioId, {
      allowArchived: true,
    });
    const running = await findRunningStrategyRun(portfolioId, userId);
    if (!running) {
      const latest = await findLatestStrategyRun(portfolioId, userId);
      return latest ? toView(latest) : null;
    }

    let logs = pushLog(running.logs, "Stopped by user");
    await updateStrategyRunState(running.id, userId, { logs });
    const stopped = await stopStrategyRun(running.id, userId);
    return stopped ? toView(stopped) : null;
  }

  async heartbeat(
    userId: string,
    portfolioId: string,
  ): Promise<StrategyRunView | null> {
    await portfolioService.requireOwnedPortfolio(userId, portfolioId);
    const running = await findRunningStrategyRun(portfolioId, userId);
    if (!running) {
      const latest = await findLatestStrategyRun(portfolioId, userId);
      return latest ? toView(latest) : null;
    }

    const updated = await updateStrategyRunState(running.id, userId, {
      lastHeartbeatAt: new Date(),
      lastError: null,
    });
    if (!updated) return null;

    return this.tick(userId, portfolioId, updated);
  }

  /**
   * Process new closed bars while presence is fresh.
   * Catch-up fills use next-bar open; trailing live signal uses live ask/bid.
   */
  async tick(
    userId: string,
    portfolioId: string,
    seeded?: StrategyRunRecord,
  ): Promise<StrategyRunView> {
    const run =
      seeded ?? (await findRunningStrategyRun(portfolioId, userId));
    if (!run || run.status !== "running") {
      throw new AppError("No running strategy", 404, "RUN_NOT_FOUND");
    }

    if (derivePresence(run) === "idle") {
      return toView(run);
    }

    let logs = [...run.logs];
    try {
      const strategy = await findStrategyForUser(run.strategyId, userId);
      if (!strategy) {
        throw new AppError("Strategy not found", 404, "STRATEGY_NOT_FOUND");
      }

      const portfolio = await portfolioService.requireOwnedPortfolio(
        userId,
        portfolioId,
      );
      const exchange = (await portfolioService.resolveExchange(
        userId,
        portfolio,
      )) as PreferredExchange;

      const { interval } = resolveBacktestInterval(strategy.timeframe, exchange);
      const compiled = compileStrategy(strategy.sourceCode);
      if (!compiled.ok) {
        throw new AppError(
          "Strategy compile failed during tick",
          400,
          "STRATEGY_COMPILE_FAILED",
        );
      }

      const candles = await marketService.getCandles(
        run.symbol,
        interval,
        exchange,
      );
      const bars = candlesToBars(candles);
      const nowSec = Math.floor(Date.now() / 1000);
      const lastProcessedSec = run.lastProcessedBarTime
        ? Math.floor(run.lastProcessedBarTime.getTime() / 1000)
        : 0;

      const closedIndexes: number[] = [];
      for (let i = 0; i < bars.length; i += 1) {
        if (
          isBarClosed(bars[i], interval, nowSec) &&
          bars[i].time > lastProcessedSec
        ) {
          closedIndexes.push(i);
        }
      }

      if (closedIndexes.length === 0) {
        const refreshed = await updateStrategyRunState(run.id, userId, {
          lastHeartbeatAt: new Date(),
        });
        return toView(refreshed ?? run);
      }

      if (closedIndexes.length > 1) {
        logs = pushLog(
          logs,
          `Catch-up: ${closedIndexes.length} closed bars since last visit`,
        );
      }

      const queue: {
        pending: { side: "buy" | "sell"; intent: OrderIntent } | null;
      } = { pending: null };

      let lastProcessed = run.lastProcessedBarTime;

      for (let n = 0; n < closedIndexes.length; n += 1) {
        const barIndex = closedIndexes[n];
        const bar = bars[barIndex];
        const isLastNew = n === closedIndexes.length - 1;

        if (queue.pending) {
          const fillPrice = bar.open;
          logs = await this.fillIntent({
            userId,
            portfolioId,
            symbol: run.symbol,
            pending: queue.pending,
            fillPrice,
            useLivePrice: false,
            logs,
          });
          queue.pending = null;
        }

        await this.evaluateBar({
          strategy: compiled.strategy,
          params: strategy.params,
          bars: bars.slice(0, barIndex + 1),
          symbol: run.symbol,
          userId,
          portfolioId,
          queue,
        });

        lastProcessed = new Date(bar.time * 1000);

        // Trailing signal on the newest closed bar: fill at live market.
        if (isLastNew && queue.pending) {
          logs = await this.fillIntent({
            userId,
            portfolioId,
            symbol: run.symbol,
            pending: queue.pending,
            fillPrice: bar.close,
            useLivePrice: true,
            logs,
          });
          queue.pending = null;
        }
      }

      const saved = await updateStrategyRunState(run.id, userId, {
        lastProcessedBarTime: lastProcessed,
        lastHeartbeatAt: new Date(),
        lastError: null,
        logs,
      });
      return toView(saved ?? run);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tick failed";
      logs = pushLog(logs, `Error: ${message}`);
      const saved = await updateStrategyRunState(run.id, userId, {
        lastHeartbeatAt: new Date(),
        lastError: message,
        logs,
      });
      return toView(saved ?? run);
    }
  }

  private async evaluateBar(input: {
    strategy: StrategyFn;
    params: StrategyParams;
    bars: StrategyBar[];
    symbol: string;
    userId: string;
    portfolioId: string;
    queue: {
      pending: { side: "buy" | "sell"; intent: OrderIntent } | null;
    };
  }): Promise<void> {
    const portfolio = await portfolioService.requireOwnedPortfolio(
      input.userId,
      input.portfolioId,
    );
    const positions = await findPositionsByPortfolioId(input.portfolioId);
    const position = positions.find((p) => p.symbol === input.symbol);
    const price = input.bars[input.bars.length - 1]?.close ?? 0;
    const positionSize = position?.quantity ?? 0;
    const averageCost = position?.averageCost ?? 0;
    const cash = portfolio.cashBalance;
    const allMarked =
      cash +
      positions.reduce((sum, p) => {
        if (p.symbol === input.symbol) return sum + p.quantity * price;
        return sum + p.quantity * p.averageCost;
      }, 0);
    const unrealizedPnL =
      positionSize > 0 ? (price - averageCost) * positionSize : 0;
    const indicators = createIndicators();

    const ctx = {
      symbol: input.symbol,
      bars: input.bars,
      price,
      position: {
        symbol: input.symbol,
        size: positionSize,
        averageCost,
        unrealizedPnL,
      },
      cash,
      equity: allMarked,
      portfolio: {
        cash,
        equity: allMarked,
        positions: positions.map((p) => ({
          symbol: p.symbol,
          size: p.quantity,
          averageCost: p.averageCost,
          unrealizedPnL:
            p.symbol === input.symbol
              ? unrealizedPnL
              : 0,
        })),
      },
      params: input.params,
      buy(order: OrderIntent = {}) {
        input.queue.pending = { side: "buy", intent: order };
      },
      sell(order: OrderIntent = {}) {
        input.queue.pending = { side: "sell", intent: order };
      },
      indicator: indicators,
      log() {
        // Strategy logs during live ticks are omitted to keep run logs trade-focused.
      },
    };

    input.strategy(ctx);
  }

  private async fillIntent(input: {
    userId: string;
    portfolioId: string;
    symbol: string;
    pending: { side: "buy" | "sell"; intent: OrderIntent };
    fillPrice: number;
    useLivePrice: boolean;
    logs: string[];
  }): Promise<string[]> {
    let logs = input.logs;
    const portfolio = await portfolioService.requireOwnedPortfolio(
      input.userId,
      input.portfolioId,
    );
    const positions = await findPositionsByPortfolioId(input.portfolioId);
    const position = positions.find((p) => p.symbol === input.symbol);
    const cash = portfolio.cashBalance;
    const positionSize = position?.quantity ?? 0;
    const price = input.fillPrice;
    const equity = cash + positionSize * price;

    try {
      if (input.pending.side === "buy") {
        const qty = resolveBuyQty(input.pending.intent, cash, equity, price);
        if (qty <= 0) {
          return pushLog(logs, "buy skipped — zero quantity");
        }
        if (input.useLivePrice) {
          await tradingService.executeBuy(input.userId, input.portfolioId, {
            symbol: input.symbol,
            quantity: qty,
          });
          return pushLog(
            logs,
            `live buy ${qty.toFixed(6)} ${input.symbol}`,
          );
        }
        await tradingService.executeBuyAtPrice(input.userId, input.portfolioId, {
          symbol: input.symbol,
          quantity: qty,
          price,
        });
        return pushLog(
          logs,
          `catch-up buy ${qty.toFixed(6)} ${input.symbol} @ ${price.toFixed(2)}`,
        );
      }

      const qty = Math.min(
        input.pending.intent.quantity !== undefined &&
          Number.isFinite(input.pending.intent.quantity)
          ? input.pending.intent.quantity
          : positionSize,
        positionSize,
      );
      if (qty <= 0) {
        return pushLog(logs, "sell skipped — flat");
      }
      if (input.useLivePrice) {
        await tradingService.executeSell(input.userId, input.portfolioId, {
          symbol: input.symbol,
          quantity: qty,
        });
        return pushLog(
          logs,
          `live sell ${qty.toFixed(6)} ${input.symbol}`,
        );
      }
      await tradingService.executeSellAtPrice(input.userId, input.portfolioId, {
        symbol: input.symbol,
        quantity: qty,
        price,
      });
      return pushLog(
        logs,
        `catch-up sell ${qty.toFixed(6)} ${input.symbol} @ ${price.toFixed(2)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fill failed";
      return pushLog(logs, `fill skipped — ${message}`);
    }
  }
}

export const liveRunnerService = new LiveRunnerService();
