import type {
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
} from "@paper/shared";

export {
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
} from "@paper/shared";
export type {
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
  PublicSettings,
  UpdateSettingsInput,
} from "@paper/shared";

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
