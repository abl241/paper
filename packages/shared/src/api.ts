/**
 * JSON shapes the API sends. Dates are ISO strings and money is a plain number
 * (rounded server-side), exactly as they appear on the wire.
 */
import type {
  BacktestRange,
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
  StrategyTimeframe,
  TradeSide,
} from "./constants.js";

export interface ApiResponse<T> {
  data: T;
}

export interface ApiIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    message: string;
    code?: string;
    /** Per-field problems when the request failed validation. */
    issues?: ApiIssue[];
  };
}

export interface HealthResponse {
  status: "ok" | "degraded";
  service: "backend";
  database: "ok" | "error";
}

// --- Auth ---------------------------------------------------------------

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

// --- Settings -----------------------------------------------------------

export interface PublicSettings {
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  equityResolution: EquityResolution;
  equityYAxis: EquityYAxis;
  equityDefaultRange: EquityDefaultRange;
  clockFormat: ClockFormat;
}

// --- Market data --------------------------------------------------------

export interface Ticker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  timestamp: string;
}

export interface MarketSummary {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume24h: number;
  change24h?: number;
  timestamp: string;
}

export interface MarketSummariesResponse {
  items: MarketSummary[];
  total: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: string;
}

export interface MarketTrade {
  symbol: string;
  price: number;
  quantity: number;
  side: TradeSide;
  timestamp: string;
}

export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

// --- Portfolios ---------------------------------------------------------

export interface PortfolioRecord {
  id: string;
  userId: string;
  name: string;
  startingCash: number;
  cashBalance: number;
  exchange: PreferredExchange | null;
  isDefault: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PortfolioListItem = Omit<PortfolioRecord, "userId">;

export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  averageCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface PositionWithMetrics extends Position {
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  allocationPct: number | null;
}

export interface Trade {
  id: string;
  portfolioId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  executionPrice: number;
  realizedPnL: number | null;
  executedAt: string;
  /** Set when the fill came from a live paper strategy run. */
  strategyRunId: string | null;
}

export interface PortfolioSummary {
  totalEquity: number;
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalReturnPct: number;
  cashAllocationPct: number;
}

export interface PortfolioAllocation {
  symbol: string;
  value: number;
  pct: number;
}

export interface PortfolioDetail {
  portfolio: PortfolioRecord;
  cashBalance: number;
  positions: PositionWithMetrics[];
  summary: PortfolioSummary;
  allocation: PortfolioAllocation[];
}

export interface EquityPoint {
  t: string;
  equity: number;
  kind: "cash_path" | "marked";
}

export interface PerformanceStats {
  totalEquity: number;
  startingCash: number;
  totalReturnPct: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
  tradeCount: number;
  closedTradeCount: number;
  equityCurve: EquityPoint[];
}

export interface TradeExecutionResult {
  trade: Trade;
  cashBalance: number;
}

// --- Watchlist ----------------------------------------------------------

export interface WatchlistItemWithQuote {
  id: string;
  symbol: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  addedAt: string;
}

export interface WatchlistView {
  id: string;
  name: string;
  items: WatchlistItemWithQuote[];
}

// --- Strategies ---------------------------------------------------------

export type StrategyValidationStatus = "unvalidated" | "valid" | "invalid";

export type StrategyMessageLevel = "error" | "warning" | "info";

export interface StrategyMessage {
  level: StrategyMessageLevel;
  message: string;
  line?: number;
}

export type StrategyParamValue = number | string | boolean;

export type StrategyParams = Record<string, StrategyParamValue>;

export interface StrategyRiskConfig {
  maxPositionPct?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxOpenPositions?: number;
}

export interface StrategySummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  validationStatus: StrategyValidationStatus;
  symbols: string[];
  timeframe: StrategyTimeframe;
  updatedAt: string;
}

export interface StrategyDetail extends StrategySummary {
  sourceCode: string;
  validationMessages: StrategyMessage[];
  exchange: PreferredExchange | null;
  startingCapital: number;
  params: StrategyParams;
  risk: StrategyRiskConfig;
  notes: string;
  createdAt: string;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  sourceCode: string;
  symbols: string[];
  timeframe: StrategyTimeframe;
  params: StrategyParams;
  risk: StrategyRiskConfig;
}

export interface StrategyValidationResult {
  status: StrategyValidationStatus;
  messages: StrategyMessage[];
  logs: string[];
}

/** What `POST /strategies/:id/validate` returns: the result plus the saved strategy. */
export interface StrategyValidationResponse extends StrategyValidationResult {
  strategy: StrategyDetail;
}

// --- Live strategy runs -------------------------------------------------

export type StrategyRunStatus = "running" | "stopped";

/** Derived from heartbeat freshness while status is running. */
export type StrategyRunPresence = "active" | "idle" | "stopped";

export interface StrategyRunTrade {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  executionPrice: number;
  realizedPnL: number | null;
  executedAt: string;
}

export interface StrategyRunStats {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  realizedPnL: number;
  winRate: number | null;
  closedTrades: number;
}

export interface StrategyRunView {
  id: string;
  portfolioId: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  exchange: PreferredExchange | null;
  status: StrategyRunStatus;
  presence: StrategyRunPresence;
  lastProcessedBarTime: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  logs: string[];
  trades: StrategyRunTrade[];
  stats: StrategyRunStats;
  protectManualPositions: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Research -----------------------------------------------------------

export type BacktestStatus = "completed" | "failed";

export interface BacktestTrade {
  time: string;
  side: TradeSide;
  quantity: number;
  price: number;
  fee: number;
}

export interface BacktestEquityPoint {
  t: string;
  equity: number;
  kind: "marked";
}

export interface BacktestStats {
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  winRate: number;
  endingEquity: number;
  startingCapital: number;
}

export interface BacktestSummary {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  timeframe: StrategyTimeframe;
  rangeLabel: BacktestRange;
  status: BacktestStatus;
  stats: BacktestStats;
  createdAt: string;
}

export interface BacktestDetail extends BacktestSummary {
  exchange: PreferredExchange | null;
  startingCapital: number;
  feeBps: number;
  equityCurve: BacktestEquityPoint[];
  trades: BacktestTrade[];
  logs: string[];
  notes: string[];
  error: string | null;
}

// --- WebSocket ----------------------------------------------------------

export interface TickerUpdate {
  symbol: string;
  bid: number;
  ask: number;
  last?: number;
  timestamp: string;
}

export interface TradeUpdate {
  symbol: string;
  price: number;
  quantity: number;
  side: TradeSide;
  timestamp: string;
}

export type ServerMessage =
  | { type: "connected" }
  | { type: "subscribed"; symbol: string }
  | { type: "unsubscribed"; symbol: string }
  | { type: "ticker"; data: TickerUpdate }
  | { type: "trade"; data: TradeUpdate }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "subscribe"; symbol: string }
  | { type: "unsubscribe"; symbol: string };

// --- Contract helpers ---------------------------------------------------

/** What a value becomes after `JSON.stringify`: Dates turn into strings. */
export type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;
