import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileStrategy, createIndicators } from "../../src/services/strategy/runtime.js";
import { STRATEGY_TEMPLATES } from "../../src/services/strategy/templates.js";
import { validateStrategyCode } from "../../src/services/strategy/validateStrategy.js";

const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 8, 9, 10, 11, 12, 11, 10].map(
  (close) => ({ close }),
);

describe("indicators", () => {
  const indicator = createIndicators();

  it("sma averages the last N closes", () => {
    assert.equal(indicator.sma(closes, 5), 10.8);
  });

  it("ema seeds from the first close", () => {
    assert.ok(Math.abs(indicator.ema(closes, 5) - 10.387868942402099) < 1e-12);
  });

  it("rsi over the last N changes", () => {
    assert.ok(Math.abs(indicator.rsi(closes, 14) - 64.28571428571428) < 1e-12);
  });

  // Current behaviour, pinned so the Phase 1 fix shows up as a deliberate change.
  it("sma with too few bars returns the last close", () => {
    assert.equal(indicator.sma(closes.slice(0, 3), 5), 3);
  });

  it("rsi with too few bars returns 50", () => {
    assert.equal(indicator.rsi(closes.slice(0, 5), 14), 50);
  });

  it(
    "macd signal line is an EMA of the MACD series (histogram non-zero on a reversal)",
    { todo: "Phase 1: signal is ema([macdLine]) so histogram is always 0" },
    () => {
      const result = indicator.macd(closes, 3, 6, 4);
      assert.notEqual(result.histogram, 0);
    },
  );
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
});

describe("sandbox isolation", () => {
  it(
    "strategy code cannot reach the host process through constructors",
    { todo: "Phase 1: replace new Function with isolated-vm" },
    () => {
      const compiled = compileStrategy(`export default function strategy(ctx: StrategyContext) {
        const host = (() => 0).constructor("return typeof pro" + "cess")();
        ctx.log(host);
      }`);
      assert.ok(compiled.ok);
      const logs: string[] = [];
      compiled.strategy({ log: (m: string) => logs.push(m) });
      assert.deepEqual(logs, ["undefined"]);
    },
  );
});
