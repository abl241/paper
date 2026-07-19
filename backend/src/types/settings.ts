export const PRICE_REFRESH_OPTIONS = [0, 1000, 5000, 15000, 30000] as const;

export type PriceRefreshMs = (typeof PRICE_REFRESH_OPTIONS)[number];

export const EXCHANGE_OPTIONS = ["gemini", "coinbase"] as const;

export type PreferredExchange = (typeof EXCHANGE_OPTIONS)[number];

export const EQUITY_RESOLUTION_OPTIONS = ["15m", "1h", "6h", "1d"] as const;

export type EquityResolution = (typeof EQUITY_RESOLUTION_OPTIONS)[number];

export const EQUITY_Y_AXIS_OPTIONS = ["tight", "padded", "zero"] as const;

export type EquityYAxis = (typeof EQUITY_Y_AXIS_OPTIONS)[number];

export const EQUITY_RANGE_OPTIONS = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "ALL",
] as const;

export type EquityDefaultRange = (typeof EQUITY_RANGE_OPTIONS)[number];

export const CLOCK_FORMAT_OPTIONS = ["12h", "24h"] as const;

export type ClockFormat = (typeof CLOCK_FORMAT_OPTIONS)[number];

export interface UserSettings {
  userId: string;
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  equityResolution: EquityResolution;
  equityYAxis: EquityYAxis;
  equityDefaultRange: EquityDefaultRange;
  clockFormat: ClockFormat;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSettings {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  equityResolution: EquityResolution;
  equityYAxis: EquityYAxis;
  equityDefaultRange: EquityDefaultRange;
  clockFormat: ClockFormat;
}

export interface UpdateSettingsInput {
  priceRefreshMs?: PriceRefreshMs;
  exchange?: PreferredExchange;
  equityResolution?: EquityResolution;
  equityYAxis?: EquityYAxis;
  equityDefaultRange?: EquityDefaultRange;
  clockFormat?: ClockFormat;
}

export const DEFAULT_PRICE_REFRESH_MS: PriceRefreshMs = 1000;
export const DEFAULT_EXCHANGE: PreferredExchange = "gemini";
export const DEFAULT_EQUITY_RESOLUTION: EquityResolution = "1h";
export const DEFAULT_EQUITY_Y_AXIS: EquityYAxis = "tight";
export const DEFAULT_EQUITY_DEFAULT_RANGE: EquityDefaultRange = "1W";
export const DEFAULT_CLOCK_FORMAT: ClockFormat = "12h";
