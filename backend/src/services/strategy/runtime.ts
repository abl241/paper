import type { StrategyMessage } from "../../types/strategy.js";
import {
  SandboxedStrategy,
  StrategySandboxError,
  transpileStrategy,
  type StrategyBar,
} from "./sandbox.js";

export type {
  OrderIntent,
  StrategyBar,
  StrategyEffects,
  StrategyParams,
  StrategyPositionView,
  StrategySnapshot,
} from "./sandbox.js";
export { SandboxedStrategy } from "./sandbox.js";

export interface CompileStrategyResult {
  ok: true;
  /** Caller owns the isolate and must call `dispose()` when done. */
  strategy: SandboxedStrategy;
  warnings: StrategyMessage[];
}

export interface CompileStrategyError {
  ok: false;
  messages: StrategyMessage[];
}

/**
 * Friendly pre-compile checks. Security comes from the sandbox, not from these patterns;
 * they only explain up front why code that can never work in the sandbox was rejected.
 */
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
    pattern: /\bXMLHttpRequest\b|\bWebSocket\b/,
    message: "Network APIs are not available to strategies",
  },
];

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
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
  if (messages.some((item) => item.level === "error")) {
    return { ok: false, messages };
  }

  const transpiled = transpileStrategy(sourceCode.trim());
  if (!transpiled.ok) {
    return { ok: false, messages: [...messages, ...transpiled.messages] };
  }

  try {
    return {
      ok: true,
      strategy: new SandboxedStrategy(transpiled.code),
      warnings: messages,
    };
  } catch (error) {
    const detail =
      error instanceof StrategySandboxError ? error.message : "Unknown compile error";
    return {
      ok: false,
      messages: [...messages, { level: "error", message: `Compile failed: ${detail}` }],
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
