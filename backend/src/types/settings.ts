export const PRICE_REFRESH_OPTIONS = [0, 1000, 5000, 15000, 30000] as const;

export type PriceRefreshMs = (typeof PRICE_REFRESH_OPTIONS)[number];

export const EXCHANGE_OPTIONS = ["gemini", "coinbase"] as const;

export type PreferredExchange = (typeof EXCHANGE_OPTIONS)[number];

export interface UserSettings {
  userId: string;
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSettings {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
}

export interface UpdateSettingsInput {
  priceRefreshMs?: PriceRefreshMs;
  exchange?: PreferredExchange;
}

export const DEFAULT_PRICE_REFRESH_MS: PriceRefreshMs = 1000;
export const DEFAULT_EXCHANGE: PreferredExchange = "gemini";
