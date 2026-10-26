import type { PoolClient } from "pg";
import { withTransaction } from "../../config/database.js";
import {
  findPortfolioForUpdate,
  updatePortfolioCash,
} from "../../models/portfolio.model.js";
import {
  deletePosition,
  findPositionForUpdate,
  upsertPosition,
} from "../../models/position.model.js";
import { insertTrade } from "../../models/trade.model.js";
import { AppError } from "../../types/api.js";
import type {
  ExecuteOrderAtPriceInput,
  ExecuteOrderInput,
  TradeExecutionResult,
} from "../../types/trading.js";
import { roundAmount, roundUsd } from "../../utils/decimal.js";
import { normalizeSymbol } from "../../utils/symbols.js";
import { marketService } from "../market/market.service.js";
import { portfolioService } from "../portfolio/portfolio.service.js";
import {
  computeBuyFill,
  computeSellFill,
  hasSufficientCash,
  hasSufficientPosition,
} from "./portfolioMath.js";

export class TradingService {
  async executeBuy(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
    client?: PoolClient,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "buy", undefined, client);
  }

  async executeSell(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
    client?: PoolClient,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "sell", undefined, client);
  }

  async executeBuyAtPrice(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderAtPriceInput,
    client?: PoolClient,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "buy", input.price, client);
  }

  async executeSellAtPrice(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderAtPriceInput,
    client?: PoolClient,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "sell", input.price, client);
  }

  private async executeOrder(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
    side: "buy" | "sell",
    priceOverride?: number,
    /** Join an existing transaction (nested via savepoint) instead of opening one. */
    outerClient?: PoolClient,
  ): Promise<TradeExecutionResult> {
    const symbol = this.parseSymbol(input.symbol);
    const quantity = this.parseQuantity(input.quantity);

    const portfolio = await portfolioService.requireOwnedPortfolio(
      userId,
      portfolioId,
      {},
      outerClient,
    );

    let executionPrice: number;
    if (priceOverride !== undefined) {
      if (!Number.isFinite(priceOverride) || priceOverride <= 0) {
        throw new AppError(
          "Execution price must be greater than zero",
          400,
          "INVALID_PRICE",
        );
      }
      executionPrice = roundAmount(priceOverride);
    } else {
      const exchange = await portfolioService.resolveExchange(userId, portfolio);
      const ticker = await marketService.getTicker(symbol, exchange);
      executionPrice =
        side === "buy"
          ? roundAmount(ticker.ask || ticker.last)
          : roundAmount(ticker.bid || ticker.last);
    }

    return withTransaction(async (client) => {
      const locked = await findPortfolioForUpdate(client, portfolioId);
      if (!locked) {
        throw new AppError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
      }
      if (locked.archivedAt) {
        throw new AppError("Portfolio is archived", 400, "PORTFOLIO_ARCHIVED");
      }

      const fill = {
        portfolioId,
        symbol,
        quantity,
        executionPrice,
        cashBalance: locked.cashBalance,
        strategyRunId: input.strategyRunId ?? null,
        executedAt: input.executedAt,
      };
      return side === "buy"
        ? this.processBuy(client, fill)
        : this.processSell(client, fill);
    }, outerClient);
  }

  private async processBuy(
    client: PoolClient,
    input: {
      portfolioId: string;
      symbol: string;
      quantity: number;
      executionPrice: number;
      cashBalance: number;
      strategyRunId?: string | null;
      executedAt?: Date;
    },
  ): Promise<TradeExecutionResult> {
    const totalCost = roundUsd(input.quantity * input.executionPrice);

    if (!hasSufficientCash(input.cashBalance, totalCost)) {
      throw new AppError("Insufficient cash balance", 400, "INSUFFICIENT_FUNDS");
    }

    const existingPosition = await findPositionForUpdate(
      client,
      input.portfolioId,
      input.symbol,
    );

    const fill = computeBuyFill({
      cashBalance: input.cashBalance,
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      existingPosition: existingPosition
        ? {
            quantity: existingPosition.quantity,
            averageCost: existingPosition.averageCost,
          }
        : null,
    });

    await upsertPosition(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      quantity: fill.quantity,
      averageCost: fill.averageCost,
    });

    const updated = await updatePortfolioCash(
      client,
      input.portfolioId,
      fill.cashBalance,
    );

    const trade = await insertTrade(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      side: "buy",
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      realizedPnL: null,
      strategyRunId: input.strategyRunId ?? null,
      executedAt: input.executedAt,
    });

    return { trade, cashBalance: updated.cashBalance };
  }

  private async processSell(
    client: PoolClient,
    input: {
      portfolioId: string;
      symbol: string;
      quantity: number;
      executionPrice: number;
      cashBalance: number;
      strategyRunId?: string | null;
      executedAt?: Date;
    },
  ): Promise<TradeExecutionResult> {
    const position = await findPositionForUpdate(
      client,
      input.portfolioId,
      input.symbol,
    );

    if (!hasSufficientPosition(position, input.quantity)) {
      throw new AppError(
        "Insufficient position quantity",
        400,
        "INSUFFICIENT_POSITION",
      );
    }

    const fill = computeSellFill({
      cashBalance: input.cashBalance,
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      position: {
        quantity: position.quantity,
        averageCost: position.averageCost,
      },
    });

    if (fill.shouldDeletePosition) {
      await deletePosition(client, input.portfolioId, input.symbol);
    } else {
      await upsertPosition(client, {
        portfolioId: input.portfolioId,
        symbol: input.symbol,
        quantity: fill.remainingQuantity,
        averageCost: position.averageCost,
      });
    }

    const updated = await updatePortfolioCash(
      client,
      input.portfolioId,
      fill.cashBalance,
    );

    const trade = await insertTrade(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      side: "sell",
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      realizedPnL: fill.realizedPnL,
      strategyRunId: input.strategyRunId ?? null,
      executedAt: input.executedAt,
    });

    return { trade, cashBalance: updated.cashBalance };
  }

  private parseSymbol(symbolInput: string): string {
    try {
      return normalizeSymbol(symbolInput);
    } catch {
      throw new AppError(
        `Invalid symbol: ${symbolInput}`,
        400,
        "INVALID_SYMBOL",
      );
    }
  }

  private parseQuantity(quantity: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(
        "Quantity must be greater than zero",
        400,
        "INVALID_QUANTITY",
      );
    }

    return roundAmount(quantity);
  }
}

export const tradingService = new TradingService();
