import {
  createSettings,
  findSettingsByUserId,
  updateSettings,
} from "../../models/settings.model.js";
import { AppError } from "../../types/api.js";
import {
  CLOCK_FORMAT_OPTIONS,
  DEFAULT_CLOCK_FORMAT,
  DEFAULT_EQUITY_DEFAULT_RANGE,
  DEFAULT_EQUITY_RESOLUTION,
  DEFAULT_EQUITY_Y_AXIS,
  DEFAULT_EXCHANGE,
  DEFAULT_PRICE_REFRESH_MS,
  EQUITY_RANGE_OPTIONS,
  EQUITY_RESOLUTION_OPTIONS,
  EQUITY_Y_AXIS_OPTIONS,
  EXCHANGE_OPTIONS,
  PRICE_REFRESH_OPTIONS,
  type ClockFormat,
  type EquityDefaultRange,
  type EquityResolution,
  type EquityYAxis,
  type PreferredExchange,
  type PriceRefreshMs,
  type PublicSettings,
  type UpdateSettingsInput,
} from "../../types/settings.js";

function toPublicSettings(settings: {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  equityResolution: EquityResolution;
  equityYAxis: EquityYAxis;
  equityDefaultRange: EquityDefaultRange;
  clockFormat: ClockFormat;
}): PublicSettings {
  return {
    priceRefreshMs: settings.priceRefreshMs,
    exchange: settings.exchange,
    equityResolution: settings.equityResolution,
    equityYAxis: settings.equityYAxis,
    equityDefaultRange: settings.equityDefaultRange,
    clockFormat: settings.clockFormat,
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

function isValidEquityResolution(value: unknown): value is EquityResolution {
  return (
    typeof value === "string" &&
    (EQUITY_RESOLUTION_OPTIONS as readonly string[]).includes(value)
  );
}

function isValidEquityYAxis(value: unknown): value is EquityYAxis {
  return (
    typeof value === "string" &&
    (EQUITY_Y_AXIS_OPTIONS as readonly string[]).includes(value)
  );
}

function isValidEquityDefaultRange(
  value: unknown,
): value is EquityDefaultRange {
  return (
    typeof value === "string" &&
    (EQUITY_RANGE_OPTIONS as readonly string[]).includes(value)
  );
}

function isValidClockFormat(value: unknown): value is ClockFormat {
  return (
    typeof value === "string" &&
    (CLOCK_FORMAT_OPTIONS as readonly string[]).includes(value)
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
      DEFAULT_EQUITY_RESOLUTION,
      DEFAULT_EQUITY_Y_AXIS,
      DEFAULT_EQUITY_DEFAULT_RANGE,
      DEFAULT_CLOCK_FORMAT,
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
    const equityResolution =
      input.equityResolution !== undefined
        ? input.equityResolution
        : current.equityResolution;
    const equityYAxis =
      input.equityYAxis !== undefined ? input.equityYAxis : current.equityYAxis;
    const equityDefaultRange =
      input.equityDefaultRange !== undefined
        ? input.equityDefaultRange
        : current.equityDefaultRange;
    const clockFormat =
      input.clockFormat !== undefined ? input.clockFormat : current.clockFormat;

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

    if (!isValidEquityResolution(equityResolution)) {
      throw new AppError(
        "Invalid equity resolution. Allowed: 15m, 1h, 6h, 1d",
        400,
        "INVALID_SETTINGS",
      );
    }

    if (!isValidEquityYAxis(equityYAxis)) {
      throw new AppError(
        "Invalid equity Y-axis mode. Allowed: tight, padded, zero",
        400,
        "INVALID_SETTINGS",
      );
    }

    if (!isValidEquityDefaultRange(equityDefaultRange)) {
      throw new AppError(
        "Invalid equity default range. Allowed: 1D, 1W, 1M, 3M, YTD, ALL",
        400,
        "INVALID_SETTINGS",
      );
    }

    if (!isValidClockFormat(clockFormat)) {
      throw new AppError(
        "Invalid clock format. Allowed: 12h, 24h",
        400,
        "INVALID_SETTINGS",
      );
    }

    const updated = await updateSettings(
      userId,
      priceRefreshMs,
      exchange,
      equityResolution,
      equityYAxis,
      equityDefaultRange,
      clockFormat,
    );
    return toPublicSettings(updated);
  }
}

export const settingsService = new SettingsService();
