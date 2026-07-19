export type PreferredExchange = "gemini" | "coinbase";

export const STRATEGY_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;

export type StrategyTimeframe = (typeof STRATEGY_TIMEFRAMES)[number];

export const STRATEGY_TAGS = [
  "Momentum",
  "Mean Reversion",
  "Scalping",
  "Trend Following",
  "Breakout",
  "Custom",
] as const;

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

export interface StrategyDetail {
  id: string;
  name: string;
  description: string;
  sourceCode: string;
  tags: string[];
  isFavorite: boolean;
  validationStatus: StrategyValidationStatus;
  validationMessages: StrategyMessage[];
  symbols: string[];
  exchange: PreferredExchange | null;
  timeframe: StrategyTimeframe;
  startingCapital: number;
  params: StrategyParams;
  risk: StrategyRiskConfig;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  strategy: StrategyDetail;
}

export interface CreateStrategyInput {
  name: string;
  description?: string;
  sourceCode?: string;
  tags?: string[];
  symbols?: string[];
  exchange?: PreferredExchange | null;
  timeframe?: StrategyTimeframe;
  startingCapital?: number;
  params?: StrategyParams;
  risk?: StrategyRiskConfig;
  notes?: string;
  templateId?: string;
}

export interface UpdateStrategyInput {
  name?: string;
  description?: string;
  sourceCode?: string;
  tags?: string[];
  isFavorite?: boolean;
  symbols?: string[];
  exchange?: PreferredExchange | null;
  timeframe?: StrategyTimeframe;
  startingCapital?: number;
  params?: StrategyParams;
  risk?: StrategyRiskConfig;
  notes?: string;
}

export interface ApiResponse<T> {
  data: T;
}
