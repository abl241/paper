import {
  DEFAULT_EXCHANGE,
  DEFAULT_PRICE_REFRESH_MS,
  EXCHANGE_OPTIONS,
  PRICE_REFRESH_OPTIONS,
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

export function getLocalSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        priceRefreshMs: DEFAULT_PRICE_REFRESH_MS,
        exchange: DEFAULT_EXCHANGE,
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
    };
  } catch {
    return {
      priceRefreshMs: DEFAULT_PRICE_REFRESH_MS,
      exchange: DEFAULT_EXCHANGE,
    };
  }
}

export function setLocalSettings(settings: UserSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
