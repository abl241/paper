export const PRICE_REFRESH_OPTIONS = [0, 1000, 5000, 15000, 30000] as const;

export type PriceRefreshMs = (typeof PRICE_REFRESH_OPTIONS)[number];

export const EXCHANGE_OPTIONS = ["gemini", "coinbase"] as const;

export type PreferredExchange = (typeof EXCHANGE_OPTIONS)[number];

export interface UserSettings {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
}

export interface ApiResponse<T> {
  data: T;
}

export const DEFAULT_PRICE_REFRESH_MS: PriceRefreshMs = 1000;
export const DEFAULT_EXCHANGE: PreferredExchange = "gemini";

export const PRICE_REFRESH_LABELS: Record<PriceRefreshMs, string> = {
  0: "Realtime",
  1000: "1 second",
  5000: "5 seconds",
  15000: "15 seconds",
  30000: "30 seconds",
};

export const EXCHANGE_LABELS: Record<PreferredExchange, string> = {
  gemini: "Gemini",
  coinbase: "Coinbase",
};
