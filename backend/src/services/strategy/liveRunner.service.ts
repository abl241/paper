import type { PoolClient } from "pg";
import { withTransaction } from "../../config/database.js";
import {
  findLatestStrategyRun,
  findRunningStrategyRun,
  findStrategyRunForUpdate,
  insertStrategyRun,
  stopRunningStrategyRunForPortfolio,
  stopStrategyRun,
  updateStrategyRunState,
} from "../../models/strategy-run.model.js";
import { findStrategyForUser } from "../../models/strategy.model.js";
import { findPositionsByPortfolioId } from "../../models/position.model.js";
import { findTradesByStrategyRunId } from "../../models/trade.model.js";
import { AppError } from "../../types/api.js";
import type { Trade } from "../../types/portfolio.js";
import type { PreferredExchange } from "../../types/settings.js";
import type { StrategyRecord } from "../../types/strategy.js";
import type {
  StartStrategyRunInput,
  StrategyRunPresence,
  StrategyRunRecord,
  StrategyRunStats,
  StrategyRunTrade,
  StrategyRunView,
} from "../../types/strategyRun.js";
import { normalizeSymbol } from "../../utils/symbols.js";
import { marketService } from "../market/market.service.js";
import { portfolioService } from "../portfolio/portfolio.service.js";
import { resolveBacktestInterval } from "../research/candleInterval.js";
import { tradingService } from "../trading/trading.service.js";
import {
  compileStrategy,
  type OrderIntent,
  type SandboxedStrategy,
  type StrategyBar,
  type StrategyParams,
} from "./runtime.js";
import { markEquity, resolveBuyQty, runPosition } from "./sizing.js";

const HEARTBEAT_STALE_MS = 2 * 60 * 1000;
const MAX_LOGS = 200;
const MAX_CACHED_STRATEGIES = 50;
const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "6h": 21_600,
  "1d": 86_400,
};

type PendingOrder = { side: "buy" | "sell"; intent: OrderIntent };

function emptyStats(): StrategyRunStats {
  return {
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    realizedPnL: 0,
    winRate: null,
    closedTrades: 0,
  };
}

function buildStats(trades: Trade[]): StrategyRunStats {
  const buys = trades.filter((t) => t.side === "buy");
  const sells = trades.filter((t) => t.side === "sell");
  const closed = sells.filter((t) => t.realizedPnL != null);
  const wins = closed.filter((t) => (t.realizedPnL ?? 0) > 0);
  const realizedPnL = closed.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);

  return {
    tradeCount: trades.length,
    buyCount: buys.length,
    sellCount: sells.length,
    realizedPnL,
    winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : null,
    closedTrades: closed.length,
  };
}

function mapRunTrades(trades: Trade[]): StrategyRunTrade[] {
  return trades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    quantity: trade.quantity,
    executionPrice: trade.executionPrice,
    realizedPnL: trade.realizedPnL,
    executedAt:
      trade.executedAt instanceof Date
        ? trade.executedAt.toISOString()
        : String(trade.executedAt),
  }));
}

async function toView(run: StrategyRunRecord): Promise<StrategyRunView> {
  const trades = await findTradesByStrategyRunId(run.id);
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
    trades: mapRunTrades(trades),
    stats: trades.length > 0 ? buildStats(trades) : emptyStats(),
    protectManualPositions: run.protectManualPositions,
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

/** This run's own net size and cost basis for `symbol`, read inside the tick's transaction. */
async function strategyRunHolding(
  client: PoolClient,
  runId: string,
  symbol: string,
): Promise<{ quantity: number; averageCost: number }> {
  const newestFirst = await findTradesByStrategyRunId(runId, client);
  return runPosition([...newestFirst].reverse(), symbol);
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

/** Compiled isolates per strategy version, so ticks don't re-create a V8 heap every heartbeat. */
class StrategyCache {
  private readonly entries = new Map<
    string,
    { updatedAt: number; strategy: SandboxedStrategy }
  >();

  /** Throws AppError(STRATEGY_COMPILE_FAILED) when the source does not compile. */
  get(record: StrategyRecord): SandboxedStrategy {
    const updatedAt = record.updatedAt.getTime();
    const cached = this.entries.get(record.id);
    if (cached && cached.updatedAt === updatedAt && !cached.strategy.disposed) {
      // Refresh recency.
      this.entries.delete(record.id);
      this.entries.set(record.id, cached);
      return cached.strategy;
    }
    if (cached) {
      cached.strategy.dispose();
      this.entries.delete(record.id);
    }

    const compiled = compileStrategy(record.sourceCode);
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

    this.entries.set(record.id, { updatedAt, strategy: compiled.strategy });
    while (this.entries.size > MAX_CACHED_STRATEGIES) {
      const [oldestId, oldest] = this.entries.entries().next().value!;
      oldest.strategy.dispose();
      this.entries.delete(oldestId);
    }
    return compiled.strategy;
  }
}

export class LiveRunnerService {
  private readonly strategies = new StrategyCache();

  async getActive(
    userId: string,
    portfolioId: string,
  ): Promise<StrategyRunView | null> {
    await portfolioService.requireOwnedPortfolio(userId, portfolioId, {
      allowArchived: true,
    });
    const running = await findRunningStrategyRun(portfolioId, userId);
    if (running) return await toView(running);
    const latest = await findLatestStrategyRun(portfolioId, userId);
    return latest ? await toView(latest) : null;
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

    const protectManualPositions = input.protectManualPositions !== false;

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

    // Fail fast on code that will never run.
    this.strategies.get(strategy);

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
    logs = pushLog(
      logs,
      protectManualPositions
        ? "Sells are limited to size this strategy buys — manual holdings are left alone"
        : "Sells may close the full symbol position, including manual buys",
    );
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
      protectManualPositions,
    });

    return await toView(run);
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
      return latest ? await toView(latest) : null;
    }

    const logs = pushLog(running.logs, "Stopped by user");
    await updateStrategyRunState(running.id, userId, { logs });
    const stopped = await stopStrategyRun(running.id, userId);
    return stopped ? await toView(stopped) : null;
  }

  async heartbeat(
    userId: string,
    portfolioId: string,
  ): Promise<StrategyRunView | null> {
    await portfolioService.requireOwnedPortfolio(userId, portfolioId);
    const running = await findRunningStrategyRun(portfolioId, userId);
    if (!running) {
      const latest = await findLatestStrategyRun(portfolioId, userId);
      return latest ? await toView(latest) : null;
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
   *
   * Network reads (strategy, candles) happen first. Bar processing then runs in one
   * transaction holding the run row lock: concurrent ticks for the same run serialise,
   * re-read `last_processed_bar_time`, and never fill a bar twice. If anything throws,
   * every fill from this tick rolls back and the error is recorded on the run.
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
      return await toView(run);
    }

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
      const sandboxed = this.strategies.get(strategy);
      const bars = candlesToBars(
        await marketService.getCandles(run.symbol, interval, exchange),
      );

      const saved = await withTransaction((client) =>
        this.processNewBars(client, {
          userId,
          portfolioId,
          runId: run.id,
          strategy: sandboxed,
          params: strategy.params,
          bars,
          interval,
        }),
      );
      return await toView(saved ?? run);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tick failed";
      const current =
        (await findRunningStrategyRun(portfolioId, userId)) ?? run;
      const saved = await updateStrategyRunState(run.id, userId, {
        lastHeartbeatAt: new Date(),
        lastError: message,
        logs: pushLog(current.logs, `Error: ${message}`),
      });
      return await toView(saved ?? run);
    }
  }

  private async processNewBars(
    client: PoolClient,
    input: {
      userId: string;
      portfolioId: string;
      runId: string;
      strategy: SandboxedStrategy;
      params: StrategyParams;
      bars: StrategyBar[];
      interval: string;
    },
  ): Promise<StrategyRunRecord | null> {
    const { userId, portfolioId, bars, interval } = input;

    const run = await findStrategyRunForUpdate(client, input.runId, userId);
    if (!run || run.status !== "running") {
      return run;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const lastProcessedSec = run.lastProcessedBarTime
      ? Math.floor(run.lastProcessedBarTime.getTime() / 1000)
      : 0;

    const closedIndexes: number[] = [];
    for (let i = 0; i < bars.length; i += 1) {
      if (isBarClosed(bars[i], interval, nowSec) && bars[i].time > lastProcessedSec) {
        closedIndexes.push(i);
      }
    }

    if (closedIndexes.length === 0) {
      return updateStrategyRunState(
        run.id,
        userId,
        { lastHeartbeatAt: new Date() },
        client,
      );
    }

    let logs = [...run.logs];
    if (closedIndexes.length > 1) {
      logs = pushLog(
        logs,
        `Catch-up: ${closedIndexes.length} closed bars since last visit`,
      );
    }

    const fillBase = {
      client,
      userId,
      portfolioId,
      runId: run.id,
      symbol: run.symbol,
      protectManualPositions: run.protectManualPositions,
    };
    let pending: PendingOrder | null = null;
    let lastProcessed = run.lastProcessedBarTime;

    for (let n = 0; n < closedIndexes.length; n += 1) {
      const barIndex = closedIndexes[n];
      const bar = bars[barIndex];
      const isLastNew = n === closedIndexes.length - 1;

      if (pending) {
        logs = await this.fillIntent({
          ...fillBase,
          pending,
          fillPrice: bar.open,
          fillBarTimeSec: bar.time,
          useLivePrice: false,
          logs,
        });
        pending = null;
      }

      pending = await this.evaluateBar(client, {
        strategy: input.strategy,
        params: input.params,
        bars,
        barIndex,
        symbol: run.symbol,
        userId,
        portfolioId,
        runId: run.id,
        protectManualPositions: run.protectManualPositions,
      });

      lastProcessed = new Date(bar.time * 1000);

      // Trailing signal on the newest closed bar: fill at live market.
      if (isLastNew && pending) {
        logs = await this.fillIntent({
          ...fillBase,
          pending,
          fillPrice: bar.close,
          fillBarTimeSec: bar.time,
          useLivePrice: true,
          logs,
        });
        pending = null;
      }
    }

    return updateStrategyRunState(
      run.id,
      userId,
      {
        lastProcessedBarTime: lastProcessed,
        lastHeartbeatAt: new Date(),
        lastError: null,
        logs,
      },
      client,
    );
  }

  /** Evaluate the strategy on bars[0..barIndex]; returns the order it queued, if any. */
  private async evaluateBar(
    client: PoolClient,
    input: {
      strategy: SandboxedStrategy;
      params: StrategyParams;
      bars: StrategyBar[];
      barIndex: number;
      symbol: string;
      userId: string;
      portfolioId: string;
      runId: string;
      protectManualPositions: boolean;
    },
  ): Promise<PendingOrder | null> {
    const portfolio = await portfolioService.requireOwnedPortfolio(
      input.userId,
      input.portfolioId,
      {},
      client,
    );
    const positions = await findPositionsByPortfolioId(input.portfolioId, client);
    const position = positions.find((p) => p.symbol === input.symbol);
    const price = input.bars[input.barIndex].close;
    const bookSize = position?.quantity ?? 0;
    const runHolding = input.protectManualPositions
      ? await strategyRunHolding(client, input.runId, input.symbol)
      : null;
    const visibleSize = runHolding ? runHolding.quantity : bookSize;
    const averageCost = runHolding
      ? runHolding.averageCost
      : (position?.averageCost ?? 0);
    const cash = portfolio.cashBalance;
    const equity = markEquity(cash, positions, input.symbol, price);
    const unrealizedPnL =
      visibleSize > 0 ? (price - averageCost) * visibleSize : 0;

    let pending: PendingOrder | null = null;
    input.strategy.evaluate(
      {
        symbol: input.symbol,
        bars: input.bars,
        barCount: input.barIndex + 1,
        price,
        position: {
          symbol: input.symbol,
          size: visibleSize,
          averageCost,
          unrealizedPnL,
        },
        cash,
        equity,
        portfolio: {
          cash,
          equity,
          positions: positions.map((p) => ({
            symbol: p.symbol,
            size: p.quantity,
            averageCost: p.averageCost,
            unrealizedPnL:
              p.symbol === input.symbol ? (price - p.averageCost) * p.quantity : 0,
          })),
        },
        params: input.params,
      },
      {
        buy(intent) {
          pending = { side: "buy", intent };
        },
        sell(intent) {
          pending = { side: "sell", intent };
        },
        log() {
          // Strategy logs during live ticks are omitted to keep run logs trade-focused.
        },
      },
    );
    return pending;
  }

  private async fillIntent(input: {
    client: PoolClient;
    userId: string;
    portfolioId: string;
    runId: string;
    symbol: string;
    pending: PendingOrder;
    fillPrice: number;
    /** Unix seconds for the candle this fill belongs to (for chart markers). */
    fillBarTimeSec: number;
    useLivePrice: boolean;
    protectManualPositions: boolean;
    logs: string[];
  }): Promise<string[]> {
    const { client, logs } = input;
    const portfolio = await portfolioService.requireOwnedPortfolio(
      input.userId,
      input.portfolioId,
      {},
      client,
    );
    const positions = await findPositionsByPortfolioId(input.portfolioId, client);
    const position = positions.find((p) => p.symbol === input.symbol);
    const cash = portfolio.cashBalance;
    const positionSize = position?.quantity ?? 0;
    const price = input.fillPrice;
    const equity = markEquity(cash, positions, input.symbol, price);
    const executedAt = new Date(input.fillBarTimeSec * 1000);
    const order = {
      symbol: input.symbol,
      strategyRunId: input.runId,
      executedAt,
    };

    // Trading runs in a savepoint: a rejected fill is logged and the tick continues.
    try {
      if (input.pending.side === "buy") {
        const qty = resolveBuyQty(input.pending.intent, cash, equity, price);
        if (qty <= 0) {
          return pushLog(logs, "buy skipped — zero quantity");
        }
        if (input.useLivePrice) {
          await tradingService.executeBuy(
            input.userId,
            input.portfolioId,
            { ...order, quantity: qty },
            client,
          );
          return pushLog(logs, `live buy ${qty.toFixed(6)} ${input.symbol}`);
        }
        await tradingService.executeBuyAtPrice(
          input.userId,
          input.portfolioId,
          { ...order, quantity: qty, price },
          client,
        );
        return pushLog(
          logs,
          `catch-up buy ${qty.toFixed(6)} ${input.symbol} @ ${price.toFixed(2)}`,
        );
      }

      const runNet = input.protectManualPositions
        ? (await strategyRunHolding(client, input.runId, input.symbol)).quantity
        : positionSize;
      const requestedQty =
        input.pending.intent.quantity !== undefined &&
        Number.isFinite(input.pending.intent.quantity)
          ? input.pending.intent.quantity
          : runNet;
      const qty = Math.min(requestedQty, positionSize, runNet);
      if (qty <= 0) {
        return pushLog(
          logs,
          input.protectManualPositions && runNet <= 0
            ? "sell skipped — strategy flat (won't sell manual holdings)"
            : "sell skipped — flat",
        );
      }
      if (input.useLivePrice) {
        await tradingService.executeSell(
          input.userId,
          input.portfolioId,
          { ...order, quantity: qty },
          client,
        );
        return pushLog(logs, `live sell ${qty.toFixed(6)} ${input.symbol}`);
      }
      await tradingService.executeSellAtPrice(
        input.userId,
        input.portfolioId,
        { ...order, quantity: qty, price },
        client,
      );
      return pushLog(
        logs,
        `catch-up sell ${qty.toFixed(6)} ${input.symbol} @ ${price.toFixed(2)}`,
      );
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      return pushLog(logs, `fill skipped — ${error.message}`);
    }
  }
}

export const liveRunnerService = new LiveRunnerService();
