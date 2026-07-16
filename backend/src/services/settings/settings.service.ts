import {
  createSettings,
  findSettingsByUserId,
  updateSettings,
} from "../../models/settings.model.js";
import { AppError } from "../../types/api.js";
import {
  DEFAULT_EXCHANGE,
  DEFAULT_PRICE_REFRESH_MS,
  EXCHANGE_OPTIONS,
  PRICE_REFRESH_OPTIONS,
  type PreferredExchange,
  type PriceRefreshMs,
  type PublicSettings,
  type UpdateSettingsInput,
} from "../../types/settings.js";

function toPublicSettings(settings: {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
}): PublicSettings {
  return {
    priceRefreshMs: settings.priceRefreshMs,
    exchange: settings.exchange,
  };
}

function isValidPriceRefreshMs(value: unknown): value is PriceRefreshMs {
  return (
    typeof value === "number" &&
    (PRICE_REFRESH_OPTIONS as readonly number[]).includes(value)
  );
}

function isValidExchange(value: unknown): value is PreferredExchange {
  return (
    typeof value === "string" &&
    (EXCHANGE_OPTIONS as readonly string[]).includes(value)
  );
}

export class SettingsService {
  async initialize(userId: string): Promise<PublicSettings> {
    const existing = await findSettingsByUserId(userId);
    if (existing) {
      return toPublicSettings(existing);
    }

    const created = await createSettings(
      userId,
      DEFAULT_PRICE_REFRESH_MS,
      DEFAULT_EXCHANGE,
    );
    return toPublicSettings(created);
  }

  async getSettings(userId: string): Promise<PublicSettings> {
    return this.initialize(userId);
  }

  async updateSettings(
    userId: string,
    input: UpdateSettingsInput,
  ): Promise<PublicSettings> {
    const current = await this.initialize(userId);

    const priceRefreshMs =
      input.priceRefreshMs !== undefined
        ? input.priceRefreshMs
        : current.priceRefreshMs;
    const exchange =
      input.exchange !== undefined ? input.exchange : current.exchange;

    if (!isValidPriceRefreshMs(priceRefreshMs)) {
      throw new AppError(
        "Invalid price refresh interval. Allowed: 0, 1000, 5000, 15000, 30000",
        400,
        "INVALID_SETTINGS",
      );
    }

    if (!isValidExchange(exchange)) {
      throw new AppError(
        "Invalid exchange. Allowed: gemini, coinbase",
        400,
        "INVALID_SETTINGS",
      );
    }

    const updated = await updateSettings(userId, priceRefreshMs, exchange);
    return toPublicSettings(updated);
  }
}

export const settingsService = new SettingsService();
