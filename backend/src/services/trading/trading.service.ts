import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
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
  ExecuteOrderInput,
  TradeExecutionResult,
} from "../../types/trading.js";
import { roundAmount, roundUsd } from "../../utils/decimal.js";
import { normalizeSymbol } from "../../utils/symbols.js";
import { marketService } from "../market/market.service.js";
import { portfolioService } from "../portfolio/portfolio.service.js";

export class TradingService {
  async executeBuy(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "buy");
  }

  async executeSell(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
  ): Promise<TradeExecutionResult> {
    return this.executeOrder(userId, portfolioId, input, "sell");
  }

  private async executeOrder(
    userId: string,
    portfolioId: string,
    input: ExecuteOrderInput,
    side: "buy" | "sell",
  ): Promise<TradeExecutionResult> {
    const symbol = this.parseSymbol(input.symbol);
    const quantity = this.parseQuantity(input.quantity);

    const portfolio = await portfolioService.requireOwnedPortfolio(
      userId,
      portfolioId,
    );
    const exchange = await portfolioService.resolveExchange(userId, portfolio);
    const ticker = await marketService.getTicker(symbol, exchange);
    const executionPrice =
      side === "buy"
        ? roundAmount(ticker.ask || ticker.last)
        : roundAmount(ticker.bid || ticker.last);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const locked = await findPortfolioForUpdate(client, portfolioId);
      if (!locked) {
        throw new AppError("Portfolio not found", 404, "PORTFOLIO_NOT_FOUND");
      }
      if (locked.archivedAt) {
        throw new AppError("Portfolio is archived", 400, "PORTFOLIO_ARCHIVED");
      }

      if (side === "buy") {
        const result = await this.processBuy(client, {
          portfolioId,
          symbol,
          quantity,
          executionPrice,
          cashBalance: locked.cashBalance,
        });
        await client.query("COMMIT");
        return result;
      }

      const result = await this.processSell(client, {
        portfolioId,
        symbol,
        quantity,
        executionPrice,
        cashBalance: locked.cashBalance,
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async processBuy(
    client: PoolClient,
    input: {
      portfolioId: string;
      symbol: string;
      quantity: number;
      executionPrice: number;
      cashBalance: number;
    },
  ): Promise<TradeExecutionResult> {
    const totalCost = roundUsd(input.quantity * input.executionPrice);

    if (totalCost > input.cashBalance) {
      throw new AppError("Insufficient cash balance", 400, "INSUFFICIENT_FUNDS");
    }

    const existingPosition = await findPositionForUpdate(
      client,
      input.portfolioId,
      input.symbol,
    );

    const newQuantity = roundAmount(
      (existingPosition?.quantity ?? 0) + input.quantity,
    );
    const newAverageCost = existingPosition
      ? roundAmount(
          (existingPosition.quantity * existingPosition.averageCost +
            totalCost) /
            newQuantity,
        )
      : roundAmount(input.executionPrice);

    await upsertPosition(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      quantity: newQuantity,
      averageCost: newAverageCost,
    });

    const updated = await updatePortfolioCash(
      client,
      input.portfolioId,
      roundUsd(input.cashBalance - totalCost),
    );

    const trade = await insertTrade(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      side: "buy",
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      realizedPnL: null,
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
    },
  ): Promise<TradeExecutionResult> {
    const position = await findPositionForUpdate(
      client,
      input.portfolioId,
      input.symbol,
    );

    if (!position || position.quantity < input.quantity) {
      throw new AppError(
        "Insufficient position quantity",
        400,
        "INSUFFICIENT_POSITION",
      );
    }

    const proceeds = roundUsd(input.quantity * input.executionPrice);
    const realizedPnL = roundUsd(
      (input.executionPrice - position.averageCost) * input.quantity,
    );

    const remainingQuantity = roundAmount(position.quantity - input.quantity);

    if (remainingQuantity <= 0) {
      await deletePosition(client, input.portfolioId, input.symbol);
    } else {
      await upsertPosition(client, {
        portfolioId: input.portfolioId,
        symbol: input.symbol,
        quantity: remainingQuantity,
        averageCost: position.averageCost,
      });
    }

    const updated = await updatePortfolioCash(
      client,
      input.portfolioId,
      roundUsd(input.cashBalance + proceeds),
    );

    const trade = await insertTrade(client, {
      portfolioId: input.portfolioId,
      symbol: input.symbol,
      side: "sell",
      quantity: input.quantity,
      executionPrice: input.executionPrice,
      realizedPnL,
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
