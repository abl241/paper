import { config } from "../../config/index.js";
import { pool } from "../../config/database.js";
import { insertCashLedger } from "../../models/cash-ledger.model.js";
import {
  archivePortfolio,
  createPortfolio,
  findDefaultPortfolio,
  findPortfolioForUpdate,
  findPortfolioForUser,
  findPortfoliosByUserId,
  resetPortfolioBooks,
  updatePortfolioCash,
  updatePortfolioMeta,
} from "../../models/portfolio.model.js";
import { findPositionsByPortfolioId } from "../../models/position.model.js";
import {
  findTradesByPortfolioId,
  findTradesChronological,
} from "../../models/trade.model.js";
import { AppError } from "../../types/api.js";
import type {
  CreatePortfolioInput,
  FundsInput,
  PerformanceStats,
  PortfolioAllocation,
  PortfolioDetail,
  PortfolioListItem,
  PortfolioRecord,
  PortfolioSummary,
  Position,
  PositionWithMetrics,
  Trade,
  TradeFilters,
  UpdatePortfolioInput,
} from "../../types/portfolio.js";
import { EXCHANGE_OPTIONS } from "../../types/settings.js";
import { roundUsd } from "../../utils/decimal.js";
import { marketService } from "../market/market.service.js";
import { settingsService } from "../settings/settings.service.js";
import { buildMarkedEquityCurve } from "./equityCurve.builder.js";

function toListItem(portfolio: PortfolioRecord): PortfolioListItem {
  return {
    id: portfolio.id,
    name: portfolio.name,
    cashBalance: portfolio.cashBalance,
    startingCash: portfolio.startingCash,
    exchange: portfolio.exchange,
    isDefault: portfolio.isDefault,
    archivedAt: portfolio.archivedAt?.toISOString() ?? null,
    createdAt: portfolio.createdAt.toISOString(),
    updatedAt: portfolio.updatedAt.toISOString(),
  };
}

export class PortfolioService {
  async ensureDefaultPortfolio(userId: string): Promise<PortfolioRecord> {
    const existing = await findDefaultPortfolio(userId);
    if (existing) {
      return existing;
    }

    return createPortfolio({
      userId,
      name: "Main",
      startingCash: config.startingCashBalance,
      isDefault: true,
    });
  }

  /** @deprecated alias for register/bootstrap */
  async initializeAccount(userId: string): Promise<void> {
    await this.ensureDefaultPortfolio(userId);
  }

  async listPortfolios(
    userId: string,
    includeArchived = false,
  ): Promise<PortfolioListItem[]> {
    await this.ensureDefaultPortfolio(userId);
    const portfolios = await findPortfoliosByUserId(userId, { includeArchived });
    return portfolios.map(toListItem);
  }

  async createPortfolio(
    userId: string,
    input: CreatePortfolioInput,
  ): Promise<PortfolioListItem> {
    const name = input.name?.trim();
    if (!name || name.length > 64) {
      throw new AppError(
        "Portfolio name is required (max 64 characters)",
        400,
        "INVALID_PORTFOLIO",
      );
    }

    const startingCash =
      input.startingCash !== undefined
        ? input.startingCash
        : config.startingCashBalance;

    if (!Number.isFinite(startingCash) || startingCash < 0) {
      throw new AppError("Invalid starting cash", 400, "INVALID_PORTFOLIO");
    }

    if (
      input.exchange != null &&
      !(EXCHANGE_OPTIONS as readonly string[]).includes(input.exchange)
    ) {
      throw new AppError("Invalid exchange", 400, "INVALID_PORTFOLIO");
    }

    await this.ensureDefaultPortfolio(userId);

    const portfolio = await createPortfolio({
      userId,
      name,
      startingCash,
      exchange: input.exchange ?? null,
      isDefault: false,
    });

    return toListItem(portfolio);
  }

  async requireOwnedPortfolio(
    userId: string,
    portfolioId: string,
    options: { allowArchived?: boolean } = {},
  ): Promise<PortfolioRecord> {
    const portfolio = await findPortfolioForUser(portfolioId, userId);
    if (!portfolio) {
      throw new AppError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
    }
    if (!options.allowArchived && portfolio.archivedAt) {
      throw new AppError("Portfolio is archived", 400, "PORTFOLIO_ARCHIVED");
    }
    return portfolio;
  }

  async resolveExchange(
    userId: string,
    portfolio: PortfolioRecord,
  ): Promise<string> {
    if (portfolio.exchange) {
      return portfolio.exchange;
    }
    const settings = await settingsService.getSettings(userId);
    return settings.exchange;
  }

  async getPortfolioDetail(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioDetail> {
    const portfolio = await this.requireOwnedPortfolio(userId, portfolioId, {
      allowArchived: true,
    });
    const exchange = await this.resolveExchange(userId, portfolio);
    const positions = await findPositionsByPortfolioId(portfolioId);
    const trades = await findTradesByPortfolioId(portfolioId);
    const enriched = await this.enrichPositions(
      positions,
      exchange,
      portfolio.cashBalance,
    );
    const summary = this.buildSummary(
      portfolio.cashBalance,
      portfolio.startingCash,
      enriched,
      trades,
    );
    const allocation = this.buildAllocation(portfolio.cashBalance, enriched);

    return {
      portfolio,
      cashBalance: portfolio.cashBalance,
      positions: enriched,
      summary,
      allocation,
    };
  }

  async updatePortfolio(
    userId: string,
    portfolioId: string,
    input: UpdatePortfolioInput,
  ): Promise<PortfolioListItem> {
    await this.requireOwnedPortfolio(userId, portfolioId);

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name || name.length > 64) {
        throw new AppError(
          "Portfolio name is required (max 64 characters)",
          400,
          "INVALID_PORTFOLIO",
        );
      }
    }

    if (
      input.exchange !== undefined &&
      input.exchange !== null &&
      !(EXCHANGE_OPTIONS as readonly string[]).includes(input.exchange)
    ) {
      throw new AppError("Invalid exchange", 400, "INVALID_PORTFOLIO");
    }

    const updated = await updatePortfolioMeta(portfolioId, {
      name: input.name?.trim(),
      exchange: input.exchange,
    });
    return toListItem(updated);
  }

  async archivePortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioListItem> {
    const portfolio = await this.requireOwnedPortfolio(userId, portfolioId);
    const active = await findPortfoliosByUserId(userId, {
      includeArchived: false,
    });
    if (active.length <= 1) {
      throw new AppError(
        "Cannot archive your only active portfolio",
        400,
        "LAST_PORTFOLIO",
      );
    }

    const archived = await archivePortfolio(portfolio.id);
    return toListItem(archived);
  }

  async resetPortfolio(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioDetail> {
    await this.requireOwnedPortfolio(userId, portfolioId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const locked = await findPortfolioForUpdate(client, portfolioId);
      if (!locked) {
        throw new AppError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
      }

      const reset = await resetPortfolioBooks(
        client,
        portfolioId,
        locked.startingCash,
      );
      await insertCashLedger(client, {
        portfolioId,
        type: "reset",
        amount: locked.startingCash,
        balanceAfter: locked.startingCash,
        note: "Portfolio reset",
      });
      await client.query("COMMIT");

      return this.getPortfolioDetail(userId, reset.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async adjustFunds(
    userId: string,
    portfolioId: string,
    input: FundsInput,
  ): Promise<PortfolioDetail> {
    await this.requireOwnedPortfolio(userId, portfolioId);
    const amount = Number(input.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Amount must be greater than zero", 400, "INVALID_FUNDS");
    }

    if (input.type !== "deposit" && input.type !== "withdraw") {
      throw new AppError("Invalid funds type", 400, "INVALID_FUNDS");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const locked = await findPortfolioForUpdate(client, portfolioId);
      if (!locked) {
        throw new AppError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
      }

      const nextBalance =
        input.type === "deposit"
          ? roundUsd(locked.cashBalance + amount)
          : roundUsd(locked.cashBalance - amount);

      if (nextBalance < 0) {
        throw new AppError("Insufficient cash balance", 400, "INSUFFICIENT_FUNDS");
      }

      await updatePortfolioCash(client, portfolioId, nextBalance);
      await insertCashLedger(client, {
        portfolioId,
        type: input.type,
        amount: roundUsd(amount),
        balanceAfter: nextBalance,
        note: input.note ?? null,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return this.getPortfolioDetail(userId, portfolioId);
  }

  async getTrades(
    userId: string,
    portfolioId: string,
    filters: TradeFilters = {},
  ): Promise<Trade[]> {
    await this.requireOwnedPortfolio(userId, portfolioId, {
      allowArchived: true,
    });
    return findTradesByPortfolioId(portfolioId, filters);
  }

  async getPerformance(
    userId: string,
    portfolioId: string,
  ): Promise<PerformanceStats> {
    const detail = await this.getPortfolioDetail(userId, portfolioId);
    const chronological = await findTradesChronological(portfolioId);
    const closed = chronological.filter(
      (trade) => trade.side === "sell" && trade.realizedPnL != null,
    );

    const wins = closed.filter((t) => (t.realizedPnL ?? 0) > 0);
    const losses = closed.filter((t) => (t.realizedPnL ?? 0) < 0);
    const realizedValues = closed.map((t) => t.realizedPnL ?? 0);

    const exchange = await this.resolveExchange(userId, detail.portfolio);
    const settings = await settingsService.getSettings(userId);
    const equityCurve = await buildMarkedEquityCurve({
      startingCash: detail.portfolio.startingCash,
      createdAt: detail.portfolio.createdAt,
      trades: chronological,
      exchange,
      resolution: settings.equityResolution,
      currentEquity: detail.summary.totalEquity,
    });

    return {
      totalEquity: detail.summary.totalEquity,
      startingCash: detail.portfolio.startingCash,
      totalReturnPct: detail.summary.totalReturnPct,
      totalRealizedPnL: detail.summary.totalRealizedPnL,
      totalUnrealizedPnL: detail.summary.totalUnrealizedPnL,
      winRate:
        closed.length === 0 ? null : wins.length / closed.length,
      avgWin:
        wins.length === 0
          ? null
          : wins.reduce((s, t) => s + (t.realizedPnL ?? 0), 0) / wins.length,
      avgLoss:
        losses.length === 0
          ? null
          : losses.reduce((s, t) => s + (t.realizedPnL ?? 0), 0) /
            losses.length,
      bestTrade:
        realizedValues.length === 0 ? null : Math.max(...realizedValues),
      worstTrade:
        realizedValues.length === 0 ? null : Math.min(...realizedValues),
      tradeCount: chronological.length,
      closedTradeCount: closed.length,
      equityCurve,
    };
  }

  private async enrichPositions(
    positions: Position[],
    exchange: string,
    cashBalance: number,
  ): Promise<PositionWithMetrics[]> {
    const enriched = await Promise.all(
      positions.map(async (position) => {
        try {
          const ticker = await marketService.getTicker(position.symbol, exchange);
          const currentPrice = ticker.last;
          const marketValue = position.quantity * currentPrice;
          const costBasis = position.quantity * position.averageCost;
          const unrealizedPnL = marketValue - costBasis;

          return {
            ...position,
            currentPrice,
            marketValue,
            unrealizedPnL,
            allocationPct: null as number | null,
          };
        } catch {
          return {
            ...position,
            currentPrice: null,
            marketValue: null,
            unrealizedPnL: null,
            allocationPct: null,
          };
        }
      }),
    );

    const positionsValue = enriched.reduce(
      (total, position) => total + (position.marketValue ?? 0),
      0,
    );
    const equity = cashBalance + positionsValue;

    return enriched.map((position) => ({
      ...position,
      allocationPct:
        equity > 0 && position.marketValue != null
          ? (position.marketValue / equity) * 100
          : null,
    }));
  }

  private buildSummary(
    cashBalance: number,
    startingCash: number,
    positions: PositionWithMetrics[],
    trades: Trade[],
  ): PortfolioSummary {
    const positionsValue = positions.reduce(
      (total, position) => total + (position.marketValue ?? 0),
      0,
    );
    const totalEquity = cashBalance + positionsValue;
    const totalUnrealizedPnL = positions.reduce(
      (total, position) => total + (position.unrealizedPnL ?? 0),
      0,
    );
    const totalRealizedPnL = trades.reduce(
      (total, trade) => total + (trade.realizedPnL ?? 0),
      0,
    );

    return {
      totalEquity,
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalReturnPct:
        startingCash > 0 ? ((totalEquity - startingCash) / startingCash) * 100 : 0,
      cashAllocationPct: totalEquity > 0 ? (cashBalance / totalEquity) * 100 : 100,
    };
  }

  private buildAllocation(
    cashBalance: number,
    positions: PositionWithMetrics[],
  ): PortfolioAllocation[] {
    const positionsValue = positions.reduce(
      (total, position) => total + (position.marketValue ?? 0),
      0,
    );
    const equity = cashBalance + positionsValue;
    if (equity <= 0) {
      return [{ symbol: "CASH", value: cashBalance, pct: 100 }];
    }

    const items: PortfolioAllocation[] = positions
      .filter((p) => p.marketValue != null && p.marketValue > 0)
      .map((p) => ({
        symbol: p.symbol,
        value: p.marketValue!,
        pct: (p.marketValue! / equity) * 100,
      }));

    items.push({
      symbol: "CASH",
      value: cashBalance,
      pct: (cashBalance / equity) * 100,
    });

    return items.sort((a, b) => b.pct - a.pct);
  }
}

export const portfolioService = new PortfolioService();
