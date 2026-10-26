import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBuyFill,
  computeSellFill,
  hasSufficientCash,
  hasSufficientPosition,
} from "../../src/services/trading/portfolioMath.js";

describe("computeBuyFill", () => {
  it("debits cash and opens a new position", () => {
    const result = computeBuyFill({
      cashBalance: 10_000,
      quantity: 0.5,
      executionPrice: 40_000,
      existingPosition: null,
    });

    assert.equal(result.totalCost, 20_000);
    assert.equal(result.cashBalance, -10_000);
    assert.equal(result.quantity, 0.5);
    assert.equal(result.averageCost, 40_000);
  });

  it("averages into an existing position", () => {
    const result = computeBuyFill({
      cashBalance: 50_000,
      quantity: 1,
      executionPrice: 30_000,
      existingPosition: { quantity: 1, averageCost: 20_000 },
    });

    assert.equal(result.totalCost, 30_000);
    assert.equal(result.cashBalance, 20_000);
    assert.equal(result.quantity, 2);
    assert.equal(result.averageCost, 25_000);
  });
});

describe("computeSellFill", () => {
  it("credits cash and realizes PnL on a partial sell", () => {
    const result = computeSellFill({
      cashBalance: 1_000,
      quantity: 0.25,
      executionPrice: 44_000,
      position: { quantity: 1, averageCost: 40_000 },
    });

    assert.equal(result.proceeds, 11_000);
    assert.equal(result.realizedPnL, 1_000);
    assert.equal(result.cashBalance, 12_000);
    assert.equal(result.remainingQuantity, 0.75);
    assert.equal(result.shouldDeletePosition, false);
  });

  it("closes the position on a full sell", () => {
    const result = computeSellFill({
      cashBalance: 500,
      quantity: 2,
      executionPrice: 10,
      position: { quantity: 2, averageCost: 8 },
    });

    assert.equal(result.proceeds, 20);
    assert.equal(result.realizedPnL, 4);
    assert.equal(result.cashBalance, 520);
    assert.equal(result.remainingQuantity, 0);
    assert.equal(result.shouldDeletePosition, true);
  });
});

describe("validation helpers", () => {
  it("detects insufficient cash", () => {
    assert.equal(hasSufficientCash(100, 99.99), true);
    assert.equal(hasSufficientCash(100, 100), true);
    assert.equal(hasSufficientCash(100, 100.01), false);
  });

  it("detects insufficient position size", () => {
    assert.equal(hasSufficientPosition({ quantity: 1, averageCost: 10 }, 0.5), true);
    assert.equal(hasSufficientPosition({ quantity: 1, averageCost: 10 }, 1), true);
    assert.equal(hasSufficientPosition({ quantity: 1, averageCost: 10 }, 1.01), false);
    assert.equal(hasSufficientPosition(null, 1), false);
  });
});
