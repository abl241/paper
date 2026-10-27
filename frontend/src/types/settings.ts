import type {
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
} from "@paper/shared";
import { EQUITY_RANGE_OPTIONS } from "@paper/shared";

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
  ApiResponse,
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
  PublicSettings as UserSettings,
} from "@paper/shared";

/** Shared timespan options for portfolio equity and market charts. */
export const CHART_RANGE_OPTIONS = EQUITY_RANGE_OPTIONS;

export type ChartRange = EquityDefaultRange;

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

export const EQUITY_RESOLUTION_LABELS: Record<EquityResolution, string> = {
  "15m": "Fine (15 min)",
  "1h": "Standard (1 hour)",
  "6h": "Coarse (6 hour)",
  "1d": "Daily",
};

export const EQUITY_Y_AXIS_LABELS: Record<EquityYAxis, string> = {
  tight: "Zoom to period (best for small moves)",
  padded: "Comfortable padding",
  zero: "Always include $0",
};

export const EQUITY_RANGE_LABELS: Record<EquityDefaultRange, string> = {
  "1D": "1 day",
  "1W": "1 week",
  "1M": "1 month",
  "3M": "3 months",
  YTD: "Year to date",
  ALL: "All time",
};

export const CLOCK_FORMAT_LABELS: Record<ClockFormat, string> = {
  "12h": "12-hour (AM/PM)",
  "24h": "24-hour",
};

/** Candle granularity used when fetching market data for a chart range. */
export function candleIntervalForRange(range: ChartRange): string {
  switch (range) {
    case "1D":
      return "15m";
    case "1W":
      return "1h";
    case "1M":
      return "6h";
    case "3M":
    case "YTD":
    case "ALL":
      return "1d";
  }
}

export function rangeCutoffMs(
  range: ChartRange,
  now = Date.now(),
): number | null {
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case "1D":
      return now - day;
    case "1W":
      return now - 7 * day;
    case "1M":
      return now - 30 * day;
    case "3M":
      return now - 90 * day;
    case "YTD":
      return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    case "ALL":
      return null;
  }
}
