import type { StrategyMessage } from "../../types/strategy.js";

export interface StrategyBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StrategyFn = (ctx: unknown) => void;

export type StrategyParams = Record<string, number | string | boolean>;

export interface OrderIntent {
  symbol?: string;
  quantity?: number;
  fractionOfEquity?: number;
  fractionOfCash?: number;
}

export interface CompileStrategyResult {
  ok: true;
  strategy: StrategyFn;
  warnings: StrategyMessage[];
}

export interface CompileStrategyError {
  ok: false;
  messages: StrategyMessage[];
}

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

export function createIndicators() {
  return {
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
  };
}

/**
 * Strip TypeScript-ish syntax enough for a Function sandbox run.
 */
export function prepareRunnableSource(source: string): string {
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

export function scanStrategySource(sourceCode: string): StrategyMessage[] {
  const messages: StrategyMessage[] = [];
  const trimmed = sourceCode.trim();

  if (!trimmed) {
    messages.push({ level: "error", message: "Source code is empty" });
    return messages;
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

  return messages;
}

export function compileStrategy(
  sourceCode: string,
): CompileStrategyResult | CompileStrategyError {
  const messages = scanStrategySource(sourceCode);
  const errors = messages.filter((item) => item.level === "error");
  if (errors.length > 0) {
    return { ok: false, messages };
  }

  try {
    const runnable = prepareRunnableSource(sourceCode.trim());
    // eslint-disable-next-line no-new-func -- intentional sandbox of user strategy
    const factory = new Function(
      `"use strict";\n${runnable}\n; if (typeof strategy !== "function") throw new Error("strategy export missing"); return strategy;`,
    );
    const strategy = factory() as StrategyFn;
    return {
      ok: true,
      strategy,
      warnings: messages.filter((item) => item.level !== "error"),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown compile error";
    return {
      ok: false,
      messages: [
        ...messages,
        { level: "error", message: `Compile failed: ${detail}` },
      ],
    };
  }
}

export function buildMockBars(count: number): StrategyBar[] {
  const bars: StrategyBar[] = [];
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
