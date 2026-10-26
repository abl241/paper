import type {
  StrategyMessage,
  StrategyValidationResult,
} from "../../types/strategy.js";
import {
  buildMockBars,
  compileStrategy,
  type StrategyEffects,
  type StrategyParams,
  type StrategySnapshot,
} from "./runtime.js";
import { resolveBuyQty } from "./sizing.js";

const DRY_RUN_TIMEOUT_MS = 1_000;

/** One evaluation on synthetic bars; buy/sell only update a local mock book and log. */
function dryRun(
  logs: string[],
  params: StrategyParams,
): { snapshot: StrategySnapshot; effects: StrategyEffects } {
  const bars = buildMockBars(40);
  const symbol = "BTC-USD";
  const price = bars[bars.length - 1].close;
  let cash = 100_000;
  let positionSize = 0;

  const snapshot: StrategySnapshot = {
    symbol,
    bars,
    barCount: bars.length,
    price,
    position: { symbol, size: 0, averageCost: price, unrealizedPnL: 0 },
    cash,
    equity: cash,
    portfolio: { cash, equity: cash, positions: [] },
    params,
  };

  const effects: StrategyEffects = {
    buy(order) {
      const qty = resolveBuyQty(order, cash, cash, price);
      const cost = qty * price;
      if (cost > cash) {
        logs.push(`buy skipped — insufficient cash for ${qty.toFixed(6)}`);
        return;
      }
      cash -= cost;
      positionSize += qty;
      logs.push(`buy ${qty.toFixed(6)} ${symbol} @ ${price.toFixed(2)}`);
    },
    sell(order) {
      const qty = order.quantity ?? positionSize;
      if (qty <= 0 || positionSize <= 0) {
        logs.push("sell skipped — flat");
        return;
      }
      const fill = Math.min(qty, positionSize);
      cash += fill * price;
      positionSize -= fill;
      logs.push(`sell ${fill.toFixed(6)} ${symbol} @ ${price.toFixed(2)}`);
    },
    log(message) {
      logs.push(message);
    },
  };

  return { snapshot, effects };
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
    const { snapshot, effects } = dryRun(logs, params);
    compiled.strategy.evaluate(snapshot, effects, DRY_RUN_TIMEOUT_MS);
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
  } finally {
    compiled.strategy.dispose();
  }

  return {
    status: messages.some((item) => item.level === "error")
      ? "invalid"
      : "valid",
    messages,
    logs,
  };
}
