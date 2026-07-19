import type {
  StrategyMessage,
  StrategyValidationResult,
} from "../../types/strategy.js";

const FORBIDDEN_PATTERNS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /\bimport\s+/,
    message: "Imports are not allowed — use only the StrategyContext API",
  },
  {
    pattern: /\brequire\s*\(/,
    message: "require() is not allowed",
  },
  {
    pattern: /\bfetch\s*\(/,
    message: "fetch() is not allowed — use StrategyContext for market data",
  },
  {
    pattern: /\bprocess\b/,
    message: "Access to process is not allowed",
  },
  {
    pattern: /\bglobalThis\b|\bglobal\b|\bwindow\b|\bdocument\b/,
    message: "Global runtime objects are not allowed",
  },
  {
    pattern: /\beval\s*\(/,
    message: "eval() is not allowed",
  },
  {
    pattern: /\bFunction\s*\(/,
    message: "Dynamic Function constructors are not allowed",
  },
  {
    pattern: /\bXMLHttpRequest\b|\bWebSocket\b/,
    message: "Network APIs are not allowed",
  },
];

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

function rsi(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function buildMockBars(count: number) {
  const bars = [];
  let price = 100;
  const start = Date.UTC(2024, 0, 1) / 1000;
  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 5) * 1.5 + (i % 7 === 0 ? 2 : 0);
    const open = price;
    const close = Math.max(1, price + drift);
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    bars.push({
      time: start + i * 3600,
      open,
      high,
      low,
      close,
      volume: 1000 + i * 10,
    });
    price = close;
  }
  return bars;
}

function createMockContext(logs: string[], params: Record<string, number | string | boolean>) {
  const bars = buildMockBars(40);
  let positionSize = 0;
  let cash = 100_000;
  const symbol = "BTC-USD";
  const price = bars[bars.length - 1].close;

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
    buy(order?: { quantity?: number; fractionOfEquity?: number; fractionOfCash?: number }) {
      const qty =
        order?.quantity ??
        (order?.fractionOfEquity ? (cash * order.fractionOfEquity) / price : undefined) ??
        (order?.fractionOfCash ? (cash * order.fractionOfCash) / price : undefined) ??
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
    indicator: {
      rsi: (inputBars: { close: number }[], period = 14) =>
        rsi(
          inputBars.map((bar) => bar.close),
          period,
        ),
      ema: (inputBars: { close: number }[], period: number) =>
        ema(
          inputBars.map((bar) => bar.close),
          period,
        ),
      sma: (inputBars: { close: number }[], period: number) =>
        sma(
          inputBars.map((bar) => bar.close),
          period,
        ),
      macd: (
        inputBars: { close: number }[],
        fast = 12,
        slow = 26,
        signal = 9,
      ) => {
        const series = inputBars.map((bar) => bar.close);
        const macdLine = ema(series, fast) - ema(series, slow);
        const signalLine = ema([macdLine], signal);
        return {
          macd: macdLine,
          signal: signalLine,
          histogram: macdLine - signalLine,
        };
      },
    },
    log(message: string) {
      logs.push(String(message));
    },
  };
}

/**
 * Strip TypeScript-ish syntax enough for a Function dry-run.
 * Lab validation is structural + sandbox smoke test, not a full tsc pass.
 */
function prepareRunnableSource(source: string): string {
  return source
    .replace(/^import\s+.+;?\s*$/gm, "")
    .replace(/\binterface\s+\w+\s*\{[\s\S]*?\}\s*/g, "")
    .replace(/\btype\s+\w+\s*=\s*[^;]+;?\s*/g, "")
    .replace(/\bas\s+const\b/g, "")
    .replace(/\b:\s*StrategyContext\b/g, "")
    .replace(/\b:\s*Bar\[\]\b/g, "")
    .replace(/\b:\s*number\b/g, "")
    .replace(/\b:\s*string\b/g, "")
    .replace(/\b:\s*boolean\b/g, "")
    .replace(/\bexport\s+default\s+function\s+strategy\b/, "function strategy")
    .replace(/\bexport\s+default\s+/, "")
    .trim();
}

export function validateStrategyCode(
  sourceCode: string,
  params: Record<string, number | string | boolean> = {},
): StrategyValidationResult {
  const messages: StrategyMessage[] = [];
  const logs: string[] = [];
  const trimmed = sourceCode.trim();

  if (!trimmed) {
    messages.push({ level: "error", message: "Source code is empty" });
    return { status: "invalid", messages, logs };
  }

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match && match.index !== undefined) {
      messages.push({
        level: "error",
        message,
        line: lineNumberAt(trimmed, match.index),
      });
    }
  }

  if (!/export\s+default\s+function\s+strategy\s*\(/.test(trimmed)) {
    messages.push({
      level: "error",
      message:
        'Strategy must include "export default function strategy(ctx: StrategyContext)"',
    });
  }

  if (!/\bcx\b|\bctx\b/.test(trimmed)) {
    messages.push({
      level: "warning",
      message: "Strategy does not appear to use the context argument",
    });
  }

  if (messages.some((item) => item.level === "error")) {
    return { status: "invalid", messages, logs };
  }

  try {
    const runnable = prepareRunnableSource(trimmed);
    // eslint-disable-next-line no-new-func -- intentional sandbox dry-run of user strategy
    const factory = new Function(
      `"use strict";\n${runnable}\n; if (typeof strategy !== "function") throw new Error("strategy export missing"); return strategy;`,
    );
    const strategyFn = factory() as (ctx: unknown) => void;
    const ctx = createMockContext(logs, params);
    strategyFn(ctx);
    messages.push({
      level: "info",
      message: "Dry-run completed on synthetic bars",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown runtime error";
    messages.push({
      level: "error",
      message: `Dry-run failed: ${detail}`,
    });
    return { status: "invalid", messages, logs };
  }

  return {
    status: messages.some((item) => item.level === "error") ? "invalid" : "valid",
    messages,
    logs,
  };
}
