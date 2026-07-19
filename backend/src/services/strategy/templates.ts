import type { StrategyTemplate } from "../../types/strategy.js";
import {
  BLANK_STRATEGY_SOURCE,
  RSI_MEAN_REVERSION_SOURCE,
  SMA_CROSS_SOURCE,
} from "./strategyApi.js";

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "blank",
    name: "Blank Strategy",
    description: "Minimal SMA scaffold with StrategyContext hooks.",
    tags: ["Custom"],
    sourceCode: BLANK_STRATEGY_SOURCE,
    symbols: ["BTC-USD"],
    timeframe: "1h",
    params: { fastPeriod: 10, slowPeriod: 20 },
    risk: { maxPositionPct: 25, stopLossPct: 5 },
  },
  {
    id: "sma-cross",
    name: "SMA Crossover",
    description: "Enter on golden cross, exit on death cross.",
    tags: ["Momentum", "Trend Following"],
    sourceCode: SMA_CROSS_SOURCE,
    symbols: ["BTC-USD"],
    timeframe: "1h",
    params: { fastPeriod: 10, slowPeriod: 30 },
    risk: { maxPositionPct: 25, stopLossPct: 5 },
  },
  {
    id: "rsi-mean-reversion",
    name: "RSI Mean Reversion",
    description: "Buy oversold RSI, sell overbought RSI.",
    tags: ["Mean Reversion"],
    sourceCode: RSI_MEAN_REVERSION_SOURCE,
    symbols: ["ETH-USD"],
    timeframe: "15m",
    params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
    risk: { maxPositionPct: 20, stopLossPct: 4 },
  },
];

export function findTemplate(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((template) => template.id === id);
}
