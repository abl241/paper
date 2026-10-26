import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { findPositionsByPortfolioId } from "../../src/models/position.model.js";
import { findPortfolioById } from "../../src/models/portfolio.model.js";
import { tradingService } from "../../src/services/trading/trading.service.js";
import { useTestDatabase } from "../helpers/db.js";
import { installFakeExchange, type FakeExchange } from "../helpers/fakeExchange.js";
import { createAccount, type TestAccount } from "../helpers/fixtures.js";

useTestDatabase();

describe("tradingService", () => {
  let exchange: FakeExchange;
  let account: TestAccount;

  beforeEach(async () => {
    exchange = installFakeExchange("gemini");
    exchange.setTicker("BTC-USD", { bid: 9_990, ask: 10_000 });
    account = await createAccount();
  });

  async function cash(): Promise<number> {
    const portfolio = await findPortfolioById(account.portfolioId);
    return portfolio!.cashBalance;
  }

  it("market buy fills at the ask, debits cash, opens a position", async () => {
    const result = await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 2,
    });

    assert.equal(result.trade.executionPrice, 10_000);
    assert.equal(result.trade.side, "buy");
    assert.equal(result.cashBalance, 80_000);
    assert.equal(await cash(), 80_000);

    const [position] = await findPositionsByPortfolioId(account.portfolioId);
    assert.equal(position.quantity, 2);
    assert.equal(position.averageCost, 10_000);
  });

  it("market sell fills at the bid and records realized PnL", async () => {
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 2,
    });
    exchange.setTicker("BTC-USD", { bid: 11_000, ask: 11_010 });

    const result = await tradingService.executeSell(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 0.5,
    });

    assert.equal(result.trade.executionPrice, 11_000);
    assert.equal(result.trade.realizedPnL, 500);
    assert.equal(result.cashBalance, 85_500);

    const [position] = await findPositionsByPortfolioId(account.portfolioId);
    assert.equal(position.quantity, 1.5);
    assert.equal(position.averageCost, 10_000);
  });

  it("selling the whole position deletes it", async () => {
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 1,
    });
    await tradingService.executeSell(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 1,
    });

    assert.deepEqual(await findPositionsByPortfolioId(account.portfolioId), []);
  });

  it("rejects buys beyond cash", async () => {
    await assert.rejects(
      tradingService.executeBuy(account.userId, account.portfolioId, {
        symbol: "BTC-USD",
        quantity: 11,
      }),
      { code: "INSUFFICIENT_FUNDS", statusCode: 400 },
    );
    assert.equal(await cash(), 100_000);
  });

  it("rejects sells beyond the position", async () => {
    await assert.rejects(
      tradingService.executeSell(account.userId, account.portfolioId, {
        symbol: "BTC-USD",
        quantity: 1,
      }),
      { code: "INSUFFICIENT_POSITION", statusCode: 400 },
    );
  });

  it("rejects non-positive quantity", async () => {
    await assert.rejects(
      tradingService.executeBuy(account.userId, account.portfolioId, {
        symbol: "BTC-USD",
        quantity: 0,
      }),
      { code: "INVALID_QUANTITY" },
    );
  });

  it("rejects another user's portfolio", async () => {
    const other = await createAccount();
    await assert.rejects(
      tradingService.executeBuy(other.userId, account.portfolioId, {
        symbol: "BTC-USD",
        quantity: 1,
      }),
      { statusCode: 404 },
    );
  });

  it("concurrent buys cannot overdraw cash", async () => {
    // Each buy costs 30k of 100k: exactly three can succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        tradingService.executeBuy(account.userId, account.portfolioId, {
          symbol: "BTC-USD",
          quantity: 3,
        }),
      ),
    );

    const filled = results.filter((r) => r.status === "fulfilled");
    assert.equal(filled.length, 3);
    assert.equal(await cash(), 10_000);
    const [position] = await findPositionsByPortfolioId(account.portfolioId);
    assert.equal(position.quantity, 9);
  });

  it("concurrent sells cannot exceed the position", async () => {
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: "BTC-USD",
      quantity: 2,
    });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        tradingService.executeSell(account.userId, account.portfolioId, {
          symbol: "BTC-USD",
          quantity: 1,
        }),
      ),
    );

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    assert.deepEqual(await findPositionsByPortfolioId(account.portfolioId), []);
  });
});
