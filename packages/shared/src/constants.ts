/** Enumerations and limits that both sides of the API must agree on. */

export const EXCHANGE_OPTIONS = ["gemini", "coinbase"] as const;
export type PreferredExchange = (typeof EXCHANGE_OPTIONS)[number];

export const PRICE_REFRESH_OPTIONS = [0, 1000, 5000, 15000, 30000] as const;
export type PriceRefreshMs = (typeof PRICE_REFRESH_OPTIONS)[number];

export const EQUITY_RESOLUTION_OPTIONS = ["15m", "1h", "6h", "1d"] as const;
export type EquityResolution = (typeof EQUITY_RESOLUTION_OPTIONS)[number];

export const EQUITY_Y_AXIS_OPTIONS = ["tight", "padded", "zero"] as const;
export type EquityYAxis = (typeof EQUITY_Y_AXIS_OPTIONS)[number];

export const EQUITY_RANGE_OPTIONS = ["1D", "1W", "1M", "3M", "YTD", "ALL"] as const;
export type EquityDefaultRange = (typeof EQUITY_RANGE_OPTIONS)[number];

export const CLOCK_FORMAT_OPTIONS = ["12h", "24h"] as const;
export type ClockFormat = (typeof CLOCK_FORMAT_OPTIONS)[number];

export const DEFAULT_PRICE_REFRESH_MS: PriceRefreshMs = 1000;
export const DEFAULT_EXCHANGE: PreferredExchange = "gemini";
export const DEFAULT_EQUITY_RESOLUTION: EquityResolution = "1h";
export const DEFAULT_EQUITY_Y_AXIS: EquityYAxis = "tight";
export const DEFAULT_EQUITY_DEFAULT_RANGE: EquityDefaultRange = "1W";
export const DEFAULT_CLOCK_FORMAT: ClockFormat = "12h";

/** Candle intervals the market endpoints accept. */
export const CANDLE_INTERVALS = ["1m", "5m", "15m", "1h", "6h", "1d"] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export const STRATEGY_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type StrategyTimeframe = (typeof STRATEGY_TIMEFRAMES)[number];

export const STRATEGY_TAGS = [
  "Momentum",
  "Mean Reversion",
  "Scalping",
  "Trend Following",
  "Breakout",
  "Custom",
] as const;
export type StrategyTag = (typeof STRATEGY_TAGS)[number];

export const BACKTEST_RANGES = ["7d", "30d", "90d", "max"] as const;
export type BacktestRange = (typeof BACKTEST_RANGES)[number];

export const TRADE_SIDES = ["buy", "sell"] as const;
export type TradeSide = (typeof TRADE_SIDES)[number];

export const TRADE_SOURCE_FILTERS = ["all", "strategy", "manual"] as const;
export type TradeSourceFilter = (typeof TRADE_SOURCE_FILTERS)[number];

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

export const PORTFOLIO_NAME_MAX_LENGTH = 64;
export const STRATEGY_NAME_MAX_LENGTH = 80;
export const STRATEGY_SOURCE_MAX_LENGTH = 100_000;
export const MAX_FEE_BPS = 1000;
