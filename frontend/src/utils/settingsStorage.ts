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
  type UserSettings,
} from "../types/settings";

const SETTINGS_KEY = "paper_trade_settings";

function isPriceRefreshMs(value: unknown): value is PriceRefreshMs {
  return (
    typeof value === "number" &&
    (PRICE_REFRESH_OPTIONS as readonly number[]).includes(value)
  );
}

function isExchange(value: unknown): value is PreferredExchange {
  return (
    typeof value === "string" &&
    (EXCHANGE_OPTIONS as readonly string[]).includes(value)
  );
}

function isEquityResolution(value: unknown): value is EquityResolution {
  return (
    typeof value === "string" &&
    (EQUITY_RESOLUTION_OPTIONS as readonly string[]).includes(value)
  );
}

function isEquityYAxis(value: unknown): value is EquityYAxis {
  return (
    typeof value === "string" &&
    (EQUITY_Y_AXIS_OPTIONS as readonly string[]).includes(value)
  );
}

function isEquityDefaultRange(value: unknown): value is EquityDefaultRange {
  return (
    typeof value === "string" &&
    (EQUITY_RANGE_OPTIONS as readonly string[]).includes(value)
  );
}

function isClockFormat(value: unknown): value is ClockFormat {
  return (
    typeof value === "string" &&
    (CLOCK_FORMAT_OPTIONS as readonly string[]).includes(value)
  );
}

export function getLocalSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        priceRefreshMs: DEFAULT_PRICE_REFRESH_MS,
        exchange: DEFAULT_EXCHANGE,
        equityResolution: DEFAULT_EQUITY_RESOLUTION,
        equityYAxis: DEFAULT_EQUITY_Y_AXIS,
        equityDefaultRange: DEFAULT_EQUITY_DEFAULT_RANGE,
        clockFormat: DEFAULT_CLOCK_FORMAT,
      };
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      priceRefreshMs: isPriceRefreshMs(parsed.priceRefreshMs)
        ? parsed.priceRefreshMs
        : DEFAULT_PRICE_REFRESH_MS,
      exchange: isExchange(parsed.exchange)
        ? parsed.exchange
        : DEFAULT_EXCHANGE,
      equityResolution: isEquityResolution(parsed.equityResolution)
        ? parsed.equityResolution
        : DEFAULT_EQUITY_RESOLUTION,
      equityYAxis: isEquityYAxis(parsed.equityYAxis)
        ? parsed.equityYAxis
        : DEFAULT_EQUITY_Y_AXIS,
      equityDefaultRange: isEquityDefaultRange(parsed.equityDefaultRange)
        ? parsed.equityDefaultRange
        : DEFAULT_EQUITY_DEFAULT_RANGE,
      clockFormat: isClockFormat(parsed.clockFormat)
        ? parsed.clockFormat
        : DEFAULT_CLOCK_FORMAT,
    };
  } catch {
    return {
      priceRefreshMs: DEFAULT_PRICE_REFRESH_MS,
      exchange: DEFAULT_EXCHANGE,
      equityResolution: DEFAULT_EQUITY_RESOLUTION,
      equityYAxis: DEFAULT_EQUITY_Y_AXIS,
      equityDefaultRange: DEFAULT_EQUITY_DEFAULT_RANGE,
      clockFormat: DEFAULT_CLOCK_FORMAT,
    };
  }
}

export function setLocalSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
