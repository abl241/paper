import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indicatorLibrary } from "../../src/services/strategy/indicators.js";
import {
  compileStrategy,
  type SandboxedStrategy,
  type StrategySnapshot,
} from "../../src/services/strategy/runtime.js";
import {
  EVALUATE_TIMEOUT_MS,
  StrategySandboxError,
} from "../../src/services/strategy/sandbox.js";
import { STRATEGY_TEMPLATES } from "../../src/services/strategy/templates.js";
import { validateStrategyCode } from "../../src/services/strategy/validateStrategy.js";

const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10].map(
  (close) => ({ close }),
);

function compile(body: string): SandboxedStrategy {
  const compiled = compileStrategy(
    `export default function strategy(ctx: StrategyContext) {\n${body}\n}`,
  );
  assert.ok(compiled.ok, compiled.ok ? "" : JSON.stringify(compiled.messages));
  return compiled.strategy;
}

function snapshot(overrides: Partial<StrategySnapshot> = {}): StrategySnapshot {
  const bars = [100, 101, 102].map((close, i) => ({
    time: 1_700_000_000 + i * 60,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
  return {
    symbol: "BTC-USD",
    bars,
    barCount: bars.length,
    price: 102,
    position: { symbol: "BTC-USD", size: 0, averageCost: 0, unrealizedPnL: 0 },
    cash: 1000,
    equity: 1000,
    portfolio: { cash: 1000, equity: 1000, positions: [] },
    params: {},
    ...overrides,
  };
}

function capture() {
  const calls: string[] = [];
  return {
    calls,
    effects: {
      buy: (intent: object) => calls.push(`buy ${JSON.stringify(intent)}`),
      sell: (intent: object) => calls.push(`sell ${JSON.stringify(intent)}`),
      log: (message: string) => calls.push(`log ${message}`),
    },
  };
}

describe("indicators", () => {
  const indicator = indicatorLibrary();

  it("sma averages the last N closes", () => {
    assert.equal(indicator.sma(closes, 5), 10.8);
  });

  it("ema seeds from the first close", () => {
    assert.ok(Math.abs(indicator.ema(closes, 5) - 10.387868942402099) < 1e-12);
  });

  it("rsi over the last N changes", () => {
    assert.ok(Math.abs(indicator.rsi(closes, 14) - 64.28571428571428) < 1e-12);
  });

  it("sma with too few bars returns the last close", () => {
    assert.equal(indicator.sma(closes.slice(0, 3), 5), 3);
  });

  it("rsi with too few bars returns 50", () => {
    assert.equal(indicator.rsi(closes.slice(0, 5), 14), 50);
  });

  it("macd signal line is an EMA of the MACD series", () => {
    // Independent reference: EMA series seeded from the first value.
    const emaSeries = (values: number[], period: number) => {
      const k = 2 / (period + 1);
      return values.reduce<number[]>(
        (out, v, i) => [...out, i === 0 ? v : v * k + out[i - 1] * (1 - k)],
        [],
      );
    };
    const values = closes.map((c) => c.close);
    const fast = emaSeries(values, 3);
    const slow = emaSeries(values, 6);
    const macdSeries = fast.map((v, i) => v - slow[i]);
    const signalSeries = emaSeries(macdSeries, 4);
    const expectedMacd = macdSeries[macdSeries.length - 1];
    const expectedSignal = signalSeries[signalSeries.length - 1];

    const result = indicator.macd(closes, 3, 6, 4);
    assert.ok(Math.abs(result.macd - expectedMacd) < 1e-12);
    assert.ok(Math.abs(result.signal - expectedSignal) < 1e-12);
    assert.ok(Math.abs(result.histogram - (expectedMacd - expectedSignal)) < 1e-12);
    assert.notEqual(result.histogram, 0);
  });
});

describe("validateStrategyCode", () => {
  for (const template of STRATEGY_TEMPLATES) {
    it(`template "${template.id}" validates`, () => {
      const result = validateStrategyCode(template.sourceCode, template.params);
      assert.equal(result.status, "valid", JSON.stringify(result.messages));
    });
  }

  it("rejects imports", () => {
    const result = validateStrategyCode(
      `import fs from "fs";\nexport default function strategy(ctx: StrategyContext) {}`,
    );
    assert.equal(result.status, "invalid");
  });

  it("rejects a missing default export", () => {
    const result = validateStrategyCode(`function strategy(ctx) { ctx.log("x"); }`);
    assert.equal(result.status, "invalid");
  });

  it("reports runtime errors from the dry run", () => {
    const result = validateStrategyCode(
      `export default function strategy(ctx: StrategyContext) { throw new Error("boom"); }`,
    );
    assert.equal(result.status, "invalid");
    assert.ok(result.messages.some((m) => m.message.includes("boom")));
  });

  it("reports syntax errors with a line number", () => {
    const result = validateStrategyCode(
      `export default function strategy(ctx: StrategyContext) {\n  const = 1;\n}`,
    );
    assert.equal(result.status, "invalid");
    const error = result.messages.find((m) => m.level === "error");
    assert.equal(error?.line, 2);
  });

  it("accepts TypeScript syntax the old regex stripper could not handle", () => {
    const result = validateStrategyCode(`
      type Signal = "buy" | "sell" | null;
      function pick<T extends { close: number }>(bars: T[]): T | undefined {
        return bars.at(-1);
      }
      export default function strategy(ctx: StrategyContext) {
        const last = pick(ctx.bars)?.close ?? 0;
        const signal: Signal = last > 0 ? "buy" : null;
        if (signal === "buy") ctx.buy({ quantity: 1 } as const);
      }`);
    assert.equal(result.status, "valid", JSON.stringify(result.messages));
  });

  it("an infinite loop fails validation instead of hanging the server", () => {
    const started = Date.now();
    const result = validateStrategyCode(
      `export default function strategy(ctx: StrategyContext) { while (true) {} }`,
    );
    assert.equal(result.status, "invalid");
    assert.ok(result.messages.some((m) => m.message.includes("time limit")));
    assert.ok(Date.now() - started < 3_000);
  });
});

describe("sandbox isolation", () => {
  it("strategy code cannot reach the host process through constructors", () => {
    const strategy = compile(`
      const viaConstructor = (() => 0).constructor("return typeof pro" + "cess")();
      ctx.log(viaConstructor + "," + typeof require + "," + typeof globalThis.process);`);
    const { calls, effects } = capture();
    strategy.evaluate(snapshot(), effects);
    assert.deepEqual(calls, ["log undefined,undefined,undefined"]);
    strategy.dispose();
  });

  it("host functions passed in are not reachable from strategy code", () => {
    const strategy = compile(`ctx.log(ctx.buy.constructor("return typeof process")());`);
    const { calls, effects } = capture();
    strategy.evaluate(snapshot(), effects);
    assert.deepEqual(calls, ["log undefined"]);
    strategy.dispose();
  });

  it("runaway loops hit the per-call time limit", () => {
    const strategy = compile(`while (true) {}`);
    const started = Date.now();
    assert.throws(() => strategy.evaluate(snapshot(), capture().effects), (error) => {
      assert.ok(error instanceof StrategySandboxError);
      assert.match(error.message, /time limit/);
      return true;
    });
    assert.ok(Date.now() - started < EVALUATE_TIMEOUT_MS * 10);
    strategy.dispose();
  });

  it("allocation bombs hit the memory limit and dispose the isolate", () => {
    const strategy = compile(`const keep = []; while (true) keep.push(new Array(1e5).fill(1));`);
    assert.throws(
      () => strategy.evaluate(snapshot(), capture().effects, 10_000),
      /memory limit/,
    );
    assert.equal(strategy.disposed, true);
    assert.throws(() => strategy.evaluate(snapshot(), capture().effects), /no longer available/);
  });

  it("top-level code is time-limited at compile", () => {
    const compiled = compileStrategy(
      `while (true) {}\nexport default function strategy(ctx: StrategyContext) {}`,
    );
    assert.equal(compiled.ok, false);
  });

  it("ctx.bars exposes only the first barCount bars", () => {
    const strategy = compile(`ctx.log(ctx.bars.length + ":" + ctx.bars[ctx.bars.length - 1].close);`);
    const { calls, effects } = capture();
    strategy.evaluate(snapshot({ barCount: 2 }), effects);
    assert.deepEqual(calls, ["log 2:101"]);
    strategy.dispose();
  });

  it("bar mutations by the strategy do not leak into later evaluations", () => {
    const strategy = compile(
      `ctx.log(ctx.bars[0].close); try { ctx.bars[0].close = -1; } catch { /* frozen */ }`,
    );
    const { calls, effects } = capture();
    const snap = snapshot();
    strategy.evaluate(snap, effects);
    strategy.evaluate(snap, effects);
    assert.deepEqual(calls, ["log 100", "log 100"]);
    assert.equal(snap.bars[0].close, 100);
    strategy.dispose();
  });

  it("order intents keep only known numeric fields", () => {
    const strategy = compile(
      `ctx.buy({ quantity: 2, fractionOfCash: "0.5", evil: { toString() { return "x"; } } }); ctx.sell();`,
    );
    const { calls, effects } = capture();
    strategy.evaluate(snapshot(), effects);
    assert.deepEqual(calls, ['buy {"quantity":2}', "sell {}"]);
    strategy.dispose();
  });
});
