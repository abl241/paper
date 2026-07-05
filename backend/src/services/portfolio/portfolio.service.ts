import { config } from "../../config/index.js";
import {
  createCashAccount,
  findCashAccountByUserId,
} from "../../models/cash-account.model.js";
import { findPositionsByUserId } from "../../models/position.model.js";
import { findTradesByUserId } from "../../models/trade.model.js";
import type {
  Portfolio,
  PositionWithMetrics,
  Trade,
} from "../../types/portfolio.js";
import { marketService } from "../market/market.service.js";

export class PortfolioService {
  async initializeAccount(userId: string): Promise<void> {
    const existing = await findCashAccountByUserId(userId);
    if (existing) {
      return;
    }

    await createCashAccount(userId, config.startingCashBalance);
  }

  async getPortfolio(userId: string): Promise<Portfolio> {
    await this.initializeAccount(userId);

    const cashAccount = await findCashAccountByUserId(userId);
    const positions = await findPositionsByUserId(userId);
    const trades = await findTradesByUserId(userId);

    const enrichedPositions = await this.enrichPositions(positions);
    const summary = this.buildSummary(
      cashAccount?.balance ?? 0,
      enrichedPositions,
      trades,
    );

    return {
      cashBalance: cashAccount?.balance ?? 0,
      positions: enrichedPositions,
      trades,
      summary,
    };
  }

  private async enrichPositions(
    positions: Awaited<ReturnType<typeof findPositionsByUserId>>,
  ): Promise<PositionWithMetrics[]> {
    return Promise.all(
      positions.map(async (position) => {
        try {
          const ticker = await marketService.getTicker(position.symbol);
          const currentPrice = ticker.last;
          const marketValue = position.quantity * currentPrice;
          const costBasis = position.quantity * position.averageCost;
          const unrealizedPnL = marketValue - costBasis;

          return {
            ...position,
            currentPrice,
            marketValue,
            unrealizedPnL,
          };
        } catch {
          return {
            ...position,
            currentPrice: null,
            marketValue: null,
            unrealizedPnL: null,
          };
        }
      }),
    );
  }

  private buildSummary(
    cashBalance: number,
    positions: PositionWithMetrics[],
    trades: Trade[],
  ) {
    const positionsValue = positions.reduce(
      (total, position) => total + (position.marketValue ?? 0),
      0,
    );

    const totalUnrealizedPnL = positions.reduce(
      (total, position) => total + (position.unrealizedPnL ?? 0),
      0,
    );

    const totalRealizedPnL = trades.reduce(
      (total, trade) => total + (trade.realizedPnL ?? 0),
      0,
    );

    return {
      totalEquity: cashBalance + positionsValue,
      totalUnrealizedPnL,
      totalRealizedPnL,
    };
  }
}

export const portfolioService = new PortfolioService();
