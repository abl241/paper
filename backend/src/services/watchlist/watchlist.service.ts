import {
  addWatchlistItem,
  findWatchlistItems,
  removeWatchlistItem,
} from "../../models/watchlist-item.model.js";
import {
  createWatchlist,
  findWatchlistByUserId,
} from "../../models/watchlist.model.js";
import { AppError } from "../../types/api.js";
import type { WatchlistView } from "../../types/watchlist.js";
import { normalizeSymbol } from "../../utils/symbols.js";
import { marketService } from "../market/market.service.js";
import { settingsService } from "../settings/settings.service.js";

export class WatchlistService {
  async getWatchlist(userId: string): Promise<WatchlistView> {
    const watchlist = await this.ensureDefaultWatchlist(userId);
    const items = await findWatchlistItems(watchlist.id);
    const settings = await settingsService.getSettings(userId);

    const quotedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const ticker = await marketService.getTicker(
            item.symbol,
            settings.exchange,
          );
          return {
            id: item.id,
            symbol: item.symbol,
            last: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            addedAt: item.createdAt.toISOString(),
          };
        } catch {
          return {
            id: item.id,
            symbol: item.symbol,
            last: null,
            bid: null,
            ask: null,
            addedAt: item.createdAt.toISOString(),
          };
        }
      }),
    );

    return {
      id: watchlist.id,
      name: watchlist.name,
      items: quotedItems,
    };
  }

  async addSymbol(userId: string, symbolInput: string): Promise<WatchlistView> {
    const symbol = this.parseSymbol(symbolInput);
    const watchlist = await this.ensureDefaultWatchlist(userId);
    await addWatchlistItem(watchlist.id, symbol);
    return this.getWatchlist(userId);
  }

  async removeSymbol(userId: string, symbolInput: string): Promise<WatchlistView> {
    const symbol = this.parseSymbol(symbolInput);
    const watchlist = await this.ensureDefaultWatchlist(userId);
    await removeWatchlistItem(watchlist.id, symbol);
    return this.getWatchlist(userId);
  }

  async ensureDefaultWatchlist(userId: string) {
    const existing = await findWatchlistByUserId(userId);
    if (existing) {
      return existing;
    }

    return createWatchlist(userId);
  }

  private parseSymbol(symbolInput: string): string {
    try {
      return normalizeSymbol(symbolInput);
    } catch {
      throw new AppError(`Invalid symbol: ${symbolInput}`, 400, "INVALID_SYMBOL");
    }
  }
}

export const watchlistService = new WatchlistService();
