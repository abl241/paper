import type {
  StrategyMessage,
  StrategyValidationResult,
} from "../../types/strategy.js";
import {
  buildMockBars,
  compileStrategy,
  createIndicators,
  type StrategyParams,
} from "./runtime.js";

function createMockContext(logs: string[], params: StrategyParams) {
  const bars = buildMockBars(40);
  let positionSize = 0;
  let cash = 100_000;
  const symbol = "BTC-USD";
  const price = bars[bars.length - 1].close;
  const indicators = createIndicators();

  const position = {
    symbol,
    get size() {
      return positionSize;
    },
    averageCost: price,
    unrealizedPnL: 0,
  };

  return {
    symbol,
    bars,
    price,
    position,
    cash,
    equity: cash,
    portfolio: {
      cash,
      equity: cash,
      positions: [],
    },
    params,
    buy(order?: {
      quantity?: number;
      fractionOfEquity?: number;
      fractionOfCash?: number;
    }) {
      const qty =
        order?.quantity ??
        (order?.fractionOfEquity
          ? (cash * order.fractionOfEquity) / price
          : undefined) ??
        (order?.fractionOfCash
          ? (cash * order.fractionOfCash) / price
          : undefined) ??
        cash / price / 10;
      const cost = qty * price;
      if (cost > cash) {
        logs.push(`buy skipped — insufficient cash for ${qty.toFixed(6)}`);
        return;
      }
      cash -= cost;
      positionSize += qty;
      logs.push(`buy ${qty.toFixed(6)} ${symbol} @ ${price.toFixed(2)}`);
    },
    sell(order?: { quantity?: number }) {
      const qty = order?.quantity ?? positionSize;
      if (qty <= 0 || positionSize <= 0) {
        logs.push("sell skipped — flat");
        return;
      }
      const fill = Math.min(qty, positionSize);
      cash += fill * price;
      positionSize -= fill;
      logs.push(`sell ${fill.toFixed(6)} ${symbol} @ ${price.toFixed(2)}`);
    },
    indicator: indicators,
    log(message: string) {
      logs.push(String(message));
    },
  };
}

export function validateStrategyCode(
  sourceCode: string,
  params: StrategyParams = {},
): StrategyValidationResult {
  const messages: StrategyMessage[] = [];
  const logs: string[] = [];

  const compiled = compileStrategy(sourceCode);
  if (!compiled.ok) {
    return { status: "invalid", messages: compiled.messages, logs };
  }

  messages.push(...compiled.warnings);

  try {
    const ctx = createMockContext(logs, params);
    compiled.strategy(ctx);
    messages.push({
      level: "info",
      message: "Dry-run completed on synthetic bars",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown runtime error";
    messages.push({
      level: "error",
      message: `Dry-run failed: ${detail}`,
    });
    return { status: "invalid", messages, logs };
  }

  return {
    status: messages.some((item) => item.level === "error")
      ? "invalid"
      : "valid",
    messages,
    logs,
  };
}
