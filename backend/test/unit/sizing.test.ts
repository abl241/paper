import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  markEquity,
  resolveBuyQty,
  runPosition,
  type RunFill,
} from "../../src/services/strategy/sizing.js";

describe("resolveBuyQty", () => {
  it("prefers an explicit quantity", () => {
    assert.equal(resolveBuyQty({ quantity: 3, fractionOfCash: 1 }, 1000, 2000, 10), 3);
  });

  it("sizes fractionOfEquity against equity, not cash", () => {
    assert.equal(resolveBuyQty({ fractionOfEquity: 0.5 }, 1000, 2000, 10), 100);
  });

  it("sizes fractionOfCash against cash", () => {
    assert.equal(resolveBuyQty({ fractionOfCash: 0.5 }, 1000, 2000, 10), 50);
  });

  it("defaults to 10% of cash", () => {
    assert.equal(resolveBuyQty({}, 1000, 2000, 10), 10);
  });

  it("never returns a negative or non-finite size", () => {
    assert.equal(resolveBuyQty({ quantity: -5 }, 1000, 2000, 10), 0);
    assert.equal(resolveBuyQty({}, 1000, 2000, 0), 0);
  });
});

describe("markEquity", () => {
  it("marks the strategy symbol at price and other holdings at cost", () => {
    const equity = markEquity(
      1000,
      [
        { symbol: "BTC-USD", quantity: 2, averageCost: 100 },
        { symbol: "ETH-USD", quantity: 10, averageCost: 5 },
      ],
      "BTC-USD",
      150,
    );
    assert.equal(equity, 1000 + 2 * 150 + 10 * 5);
  });
});

describe("runPosition", () => {
  const buy = (quantity: number, executionPrice: number): RunFill => ({
    symbol: "BTC-USD",
    side: "buy",
    quantity,
    executionPrice,
  });
  const sell = (quantity: number, executionPrice: number): RunFill => ({
    symbol: "BTC-USD",
    side: "sell",
    quantity,
    executionPrice,
  });

  it("averages buys", () => {
    assert.deepEqual(runPosition([buy(1, 100), buy(1, 200)], "BTC-USD"), {
      quantity: 2,
      averageCost: 150,
    });
  });

  it("partial sells keep the cost basis", () => {
    assert.deepEqual(runPosition([buy(2, 100), sell(1, 500)], "BTC-USD"), {
      quantity: 1,
      averageCost: 100,
    });
  });

  it("re-entry after going flat starts a fresh cost basis", () => {
    // The old buys-only average would report (100 + 300) / 2 = 200 here.
    assert.deepEqual(runPosition([buy(1, 100), sell(1, 150), buy(1, 300)], "BTC-USD"), {
      quantity: 1,
      averageCost: 300,
    });
  });

  it("re-entry on top of a partial position averages with what remains", () => {
    assert.deepEqual(
      runPosition([buy(2, 100), sell(1, 150), buy(1, 400)], "BTC-USD"),
      { quantity: 2, averageCost: 250 },
    );
  });

  it("ignores other symbols", () => {
    const other: RunFill = { symbol: "ETH-USD", side: "buy", quantity: 5, executionPrice: 1 };
    assert.deepEqual(runPosition([other, buy(1, 100)], "BTC-USD"), {
      quantity: 1,
      averageCost: 100,
    });
  });
});
