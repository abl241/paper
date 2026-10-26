import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runBacktest } from "../../src/services/research/backtest.engine.js";
import { compileStrategy, type StrategyBar } from "../../src/services/strategy/runtime.js";
import {
  RSI_MEAN_REVERSION_SOURCE,
  SMA_CROSS_SOURCE,
} from "../../src/services/strategy/strategyApi.js";

/** Deterministic oscillating series: slow wave plus a faster ripple. */
function waveBars(count: number): StrategyBar[] {
  const bars: StrategyBar[] = [];
  let previousClose = 100;
  for (let i = 0; i < count; i += 1) {
    const open = previousClose;
    const close = 100 + Math.sin(i / 6) * 12 + Math.sin(i / 2.3) * 3;
    bars.push({
      time: 1_700_000_000 + i * 3600,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: 10,
    });
    previousClose = close;
  }
  return bars;
}

function compile(source: string) {
  const compiled = compileStrategy(source);
  assert.ok(compiled.ok, "template should compile");
  return compiled.strategy;
}

function assertClose(actual: number, expected: number, message?: string): void {
  const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-9);
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message ?? "value"}: expected ${expected}, got ${actual}`,
  );
}

// Golden values recorded from the current engine. A change here means backtest results changed.
describe("runBacktest (characterisation)", () => {
  const bars = waveBars(200);

  it("SMA crossover template on the wave series", () => {
    const result = runBacktest({
      strategy: compile(SMA_CROSS_SOURCE),
      params: { fastPeriod: 5, slowPeriod: 15 },
      bars,
      symbol: "BTC-USD",
      startingCapital: 10_000,
      feeBps: 10,
    });

    assert.equal(result.stats.tradeCount, 11);
    assert.equal(result.stats.winRate, 80);
    assertClose(result.stats.endingEquity, 11078.364111767627, "endingEquity");
    assertClose(result.stats.totalReturnPct, 10.783641117676272, "totalReturnPct");
    assertClose(result.stats.maxDrawdownPct, 3.2810922421003275, "maxDrawdownPct");
    assert.equal(result.equityCurve.length, 200);

    const [firstBuy, firstSell] = result.trades;
    assert.equal(firstBuy.side, "buy");
    assert.equal(firstBuy.time, "2023-11-15T13:13:20.000Z");
    assertClose(firstBuy.price, 108.09211492446057, "first buy price");
    assertClose(firstBuy.fee, 2.5, "first buy fee");
    assert.equal(firstSell.side, "sell");
    assertClose(firstSell.quantity, firstBuy.quantity, "round trip quantity");
  });

  it("RSI mean reversion template on the wave series", () => {
    const result = runBacktest({
      strategy: compile(RSI_MEAN_REVERSION_SOURCE),
      params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
      bars,
      symbol: "BTC-USD",
      startingCapital: 10_000,
      feeBps: 10,
    });

    assert.equal(result.stats.tradeCount, 10);
    assert.equal(result.stats.winRate, 40);
    assertClose(result.stats.endingEquity, 10000.730104375813, "endingEquity");
    assertClose(result.stats.maxDrawdownPct, 3.5280561138634035, "maxDrawdownPct");
  });

  it("fills a signal at the next bar's open, never the signal bar", () => {
    const strategy = compile(`export default function strategy(ctx: StrategyContext) {
      if (ctx.bars.length === 3 && ctx.position.size === 0) ctx.buy({ quantity: 1 });
    }`);
    const result = runBacktest({
      strategy,
      params: {},
      bars,
      symbol: "BTC-USD",
      startingCapital: 10_000,
      feeBps: 0,
    });

    assert.equal(result.trades.length, 1);
    assert.equal(result.trades[0].price, bars[3].open);
    assert.equal(result.trades[0].time, new Date(bars[3].time * 1000).toISOString());
  });

  it("drops a pending order on the final bar", () => {
    const strategy = compile(`export default function strategy(ctx: StrategyContext) {
      if (ctx.bars.length === 200) ctx.buy({ quantity: 1 });
    }`);
    const result = runBacktest({
      strategy,
      params: {},
      bars,
      symbol: "BTC-USD",
      startingCapital: 10_000,
      feeBps: 0,
    });

    assert.equal(result.trades.length, 0);
    assert.ok(result.logs.includes("pending order dropped — no next bar to fill"));
  });

  it("skips buys that exceed cash", () => {
    const strategy = compile(`export default function strategy(ctx: StrategyContext) {
      if (ctx.bars.length === 2) ctx.buy({ quantity: 1000 });
    }`);
    const result = runBacktest({
      strategy,
      params: {},
      bars,
      symbol: "BTC-USD",
      startingCapital: 10_000,
      feeBps: 0,
    });

    assert.equal(result.trades.length, 0);
    assert.ok(result.logs.includes("buy skipped — insufficient cash"));
  });
});
