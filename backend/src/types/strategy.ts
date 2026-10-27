import type {
  PreferredExchange,
  StrategyMessage,
  StrategyParams,
  StrategyRiskConfig,
  StrategyTimeframe,
  StrategyValidationStatus,
} from "@paper/shared";

export { STRATEGY_TAGS, STRATEGY_TIMEFRAMES } from "@paper/shared";
export type {
  CreateStrategyInput,
  StrategyDetail,
  StrategyMessage,
  StrategyMessageLevel,
  StrategyParams,
  StrategyParamValue,
  StrategyRiskConfig,
  StrategySummary,
  StrategyTag,
  StrategyTemplate,
  StrategyTimeframe,
  StrategyValidationResult,
  StrategyValidationStatus,
  UpdateStrategyInput,
} from "@paper/shared";

export interface StrategyRecord {
  id: string;
  userId: string;
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
  createdAt: Date;
  updatedAt: Date;
}
