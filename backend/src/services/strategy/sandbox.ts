import { transformSync, type Message } from "esbuild";
import ivm from "isolated-vm";
import type { StrategyMessage } from "../../types/strategy.js";
import { indicatorLibrary } from "./indicators.js";

/**
 * User strategies run inside an isolated-vm isolate: separate V8 heap, no Node APIs,
 * hard memory cap, and a CPU timeout per call. The host only sees copied data and
 * buy/sell/log intents.
 *
 * isolated-vm on Node 20+ requires the process to start with --no-node-snapshot.
 */

export const SANDBOX_MEMORY_MB = 32;
export const COMPILE_TIMEOUT_MS = 1_000;
export const EVALUATE_TIMEOUT_MS = 100;

export interface StrategyBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type StrategyParams = Record<string, number | string | boolean>;

export interface OrderIntent {
  symbol?: string;
  quantity?: number;
  fractionOfEquity?: number;
  fractionOfCash?: number;
}

export interface StrategyPositionView {
  symbol: string;
  size: number;
  averageCost: number;
  unrealizedPnL: number;
}

/** Everything a strategy sees for one evaluation, minus the functions. */
export interface StrategySnapshot {
  symbol: string;
  /** Full series; copied into the isolate only when a different array is passed. */
  bars: StrategyBar[];
  /** `ctx.bars` is the first `barCount` bars. */
  barCount: number;
  price: number;
  position: StrategyPositionView;
  cash: number;
  equity: number;
  portfolio: { cash: number; equity: number; positions: StrategyPositionView[] };
  params: StrategyParams;
}

export interface StrategyEffects {
  buy(intent: OrderIntent): void;
  sell(intent: OrderIntent): void;
  log(message: string): void;
}

export class StrategySandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrategySandboxError";
  }
}

const BOOTSTRAP = `
"use strict";
// Dev transpilers (tsx keepNames) may wrap functions in __name(); make it a no-op.
const __name = (target) => target;
const __indicators = (${indicatorLibrary.toString()})();
globalThis.__bars = [];
// Frozen so a strategy mutating ctx.bars cannot change what later evaluations see.
globalThis.__setBars = function (bars) {
  for (const bar of bars) Object.freeze(bar);
  globalThis.__bars = Object.freeze(bars);
};
globalThis.__evaluate = function (snap) {
  const ctx = {
    symbol: snap.symbol,
    bars: globalThis.__bars.slice(0, snap.barCount),
    price: snap.price,
    position: snap.position,
    cash: snap.cash,
    equity: snap.equity,
    portfolio: snap.portfolio,
    params: snap.params,
    indicator: __indicators,
    buy(order) { __emit("buy", JSON.stringify(order ?? {})); },
    sell(order) { __emit("sell", JSON.stringify(order ?? {})); },
    log(message) { __emit("log", String(message)); },
  };
  __strategy(ctx);
};
`;

/** TypeScript → plain JS. The default export becomes `__strategy`. */
export function transpileStrategy(
  source: string,
): { ok: true; code: string } | { ok: false; messages: StrategyMessage[] } {
  try {
    const result = transformSync(source, {
      loader: "ts",
      format: "iife",
      globalName: "__strategyModule",
      target: "es2022",
      logLevel: "silent",
    });
    return {
      ok: true,
      code: `${result.code}
const __strategy = __strategyModule.default;
if (typeof __strategy !== "function") throw new Error("strategy export missing");`,
    };
  } catch (error) {
    const errors = (error as { errors?: Message[] }).errors ?? [];
    if (errors.length === 0) {
      return {
        ok: false,
        messages: [{ level: "error", message: `Compile failed: ${describe(error)}` }],
      };
    }
    return {
      ok: false,
      messages: errors.map((item) => ({
        level: "error" as const,
        message: `Compile failed: ${item.text}`,
        ...(item.location ? { line: item.location.line } : {}),
      })),
    };
  }
}

export class SandboxedStrategy {
  private readonly isolate: ivm.Isolate;
  private readonly context: ivm.Context;
  private readonly evaluateRef: ivm.Reference<(snapshot: unknown) => void>;
  private readonly setBarsRef: ivm.Reference<(bars: unknown) => void>;
  private loadedBars: StrategyBar[] | null = null;
  private effects: StrategyEffects | null = null;

  /** Throws StrategySandboxError if the code fails to compile or its top level throws. */
  constructor(transpiledCode: string) {
    this.isolate = new ivm.Isolate({ memoryLimit: SANDBOX_MEMORY_MB });
    try {
      this.context = this.isolate.createContextSync();
      const jail = this.context.global;
      jail.setSync(
        "__emit",
        new ivm.Callback((kind: string, payload: string) => this.emit(kind, payload)),
      );
      this.isolate.compileScriptSync(BOOTSTRAP).runSync(this.context);
      this.isolate
        .compileScriptSync(transpiledCode, { filename: "strategy.js" })
        .runSync(this.context, { timeout: COMPILE_TIMEOUT_MS });
      this.evaluateRef = jail.getSync("__evaluate", { reference: true });
      this.setBarsRef = jail.getSync("__setBars", { reference: true });
    } catch (error) {
      this.dispose();
      throw new StrategySandboxError(friendlyMessage(error, COMPILE_TIMEOUT_MS));
    }
  }

  get disposed(): boolean {
    return this.isolate.isDisposed;
  }

  /** Run the strategy once. Intents are delivered synchronously to `effects`. */
  evaluate(
    snapshot: StrategySnapshot,
    effects: StrategyEffects,
    timeoutMs = EVALUATE_TIMEOUT_MS,
  ): void {
    if (this.disposed) {
      throw new StrategySandboxError("Strategy sandbox is no longer available");
    }

    const { bars, ...rest } = snapshot;
    this.effects = effects;
    try {
      if (bars !== this.loadedBars) {
        this.setBarsRef.applySync(undefined, [bars], {
          arguments: { copy: true },
          timeout: timeoutMs,
        });
        this.loadedBars = bars;
      }
      this.evaluateRef.applySync(undefined, [rest], {
        arguments: { copy: true },
        timeout: timeoutMs,
      });
    } catch (error) {
      throw new StrategySandboxError(friendlyMessage(error, timeoutMs));
    } finally {
      this.effects = null;
    }
  }

  dispose(): void {
    if (!this.isolate.isDisposed) {
      this.isolate.dispose();
    }
  }

  private emit(kind: string, payload: string): void {
    const effects = this.effects;
    if (!effects) return;
    if (kind === "log") {
      effects.log(payload);
      return;
    }
    const intent = parseIntent(payload);
    if (kind === "buy") effects.buy(intent);
    else if (kind === "sell") effects.sell(intent);
  }
}

function parseIntent(payload: string): OrderIntent {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return {};
  }
  if (typeof raw !== "object" || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const intent: OrderIntent = {};
  if (typeof source.symbol === "string") intent.symbol = source.symbol;
  for (const key of ["quantity", "fractionOfEquity", "fractionOfCash"] as const) {
    if (typeof source[key] === "number") intent[key] = source[key] as number;
  }
  return intent;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function friendlyMessage(error: unknown, timeoutMs: number): string {
  const message = describe(error);
  if (/timed out/i.test(message)) {
    return `Strategy exceeded its ${timeoutMs}ms time limit`;
  }
  if (/memory limit/i.test(message)) {
    return `Strategy exceeded its ${SANDBOX_MEMORY_MB}MB memory limit`;
  }
  return message;
}
