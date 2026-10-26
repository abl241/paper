import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { findPositionsByPortfolioId } from "../../src/models/position.model.js";
import { liveRunnerService } from "../../src/services/strategy/liveRunner.service.js";
import { tradingService } from "../../src/services/trading/trading.service.js";
import { useTestDatabase } from "../helpers/db.js";
import { installFakeExchange, type FakeBar, type FakeExchange } from "../helpers/fakeExchange.js";
import {
  createAccount,
  createTestStrategy,
  hourlyTimes,
  type TestAccount,
} from "../helpers/fixtures.js";

useTestDatabase();

/** Green bar → buy 0.1 when flat; red bar → sell everything visible to the strategy. */
const COLOR_STRATEGY = `export default function strategy(ctx: StrategyContext) {
  const bar = ctx.bars[ctx.bars.length - 1];
  if (bar.close > bar.open && ctx.position.size === 0) ctx.buy({ quantity: 0.1 });
  else if (bar.close < bar.open) ctx.sell();
}`;

const SYMBOL = "BTC-USD";
const INTERVAL = "1h";
const times = hourlyTimes(40);
/** Bars 0..29 exist before arming; 30+ are appended per test. */
const ARM_INDEX = 29;

function flat(time: number, price = 100): FakeBar {
  return { time, open: price, close: price };
}
function green(time: number, open = 100, close = 110): FakeBar {
  return { time, open, close };
}
function red(time: number, open = 110, close = 100): FakeBar {
  return { time, open, close };
}

describe("liveRunnerService", () => {
  let exchange: FakeExchange;
  let account: TestAccount;

  beforeEach(async () => {
    exchange = installFakeExchange("gemini");
    exchange.setTicker(SYMBOL, { bid: 200, ask: 201 });
    exchange.setBars(SYMBOL, INTERVAL, times.slice(0, ARM_INDEX + 1).map((t) => flat(t)));
    account = await createAccount();
  });

  async function arm(protectManualPositions?: boolean) {
    const strategy = await createTestStrategy(account.userId, COLOR_STRATEGY);
    return liveRunnerService.start(account.userId, account.portfolioId, {
      strategyId: strategy.id,
      symbol: SYMBOL,
      protectManualPositions,
    });
  }

  it("arms at the latest closed bar without replaying history", async () => {
    const run = await arm();

    assert.equal(run.status, "running");
    assert.equal(run.presence, "active");
    assert.equal(run.lastProcessedBarTime, new Date(times[ARM_INDEX] * 1000).toISOString());
    assert.equal(run.trades.length, 0);
    assert.equal(run.protectManualPositions, true);
  });

  it("only one running run per portfolio: re-arming stops the previous run", async () => {
    const first = await arm();
    const second = await arm();
    assert.notEqual(first.id, second.id);
    const active = await liveRunnerService.getActive(account.userId, account.portfolioId);
    assert.equal(active?.id, second.id);
  });

  it("heartbeat with no new bars places no trades", async () => {
    await arm();
    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 0);
  });

  it("catch-up signal fills at the next bar open; trailing signal fills at live quote", async () => {
    await arm();
    // Bar 30 green → buy, filled at bar 31's open. Bar 31 red (last new bar) → sell at live bid.
    exchange.appendBars(SYMBOL, INTERVAL, [
      green(times[30], 100, 110),
      red(times[31], 120, 105),
    ]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.ok(view);
    // Newest first, tie-broken by insertion order; both fills share bar 31's timestamp.
    const trades = [...view.trades].reverse();

    assert.equal(trades.length, 2, view.logs.join("\n"));
    const [buy, sell] = trades;
    assert.equal(buy.side, "buy");
    assert.equal(buy.quantity, 0.1);
    assert.equal(buy.executionPrice, 120);
    assert.equal(buy.executedAt, new Date(times[31] * 1000).toISOString());

    assert.equal(sell.side, "sell");
    assert.equal(sell.executionPrice, 200);
    assert.equal(sell.executedAt, new Date(times[31] * 1000).toISOString());
    assert.ok(Math.abs((sell.realizedPnL ?? 0) - 8) < 1e-9);

    assert.equal(view.lastProcessedBarTime, new Date(times[31] * 1000).toISOString());
    assert.equal(view.stats.tradeCount, 2);
    assert.deepEqual(await findPositionsByPortfolioId(account.portfolioId), []);
  });

  it("does not reprocess bars on the next heartbeat", async () => {
    await arm();
    exchange.appendBars(SYMBOL, INTERVAL, [green(times[30])]);
    await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 1);
  });

  it("protectManualPositions: strategy sells never touch manual holdings", async () => {
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: SYMBOL,
      quantity: 1,
    });
    await arm(true);
    exchange.appendBars(SYMBOL, INTERVAL, [red(times[30]), flat(times[31])]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 0);
    assert.ok(view?.logs.some((l) => l.includes("strategy flat")));
    const [position] = await findPositionsByPortfolioId(account.portfolioId);
    assert.equal(position.quantity, 1);
  });

  it("protectManualPositions off: strategy sells may close manual holdings", async () => {
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: SYMBOL,
      quantity: 1,
    });
    await arm(false);
    exchange.appendBars(SYMBOL, INTERVAL, [red(times[30]), flat(times[31])]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 1);
    assert.equal(view?.trades[0].quantity, 1);
    assert.deepEqual(await findPositionsByPortfolioId(account.portfolioId), []);
  });

  it("strategy errors are recorded on the run instead of thrown", async () => {
    const strategy = await createTestStrategy(
      account.userId,
      `export default function strategy(ctx: StrategyContext) {
        if (ctx.bars.length > 30) throw new Error("kaboom");
      }`,
    );
    await liveRunnerService.start(account.userId, account.portfolioId, {
      strategyId: strategy.id,
      symbol: SYMBOL,
    });
    exchange.appendBars(SYMBOL, INTERVAL, [flat(times[30])]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.lastError, "kaboom");
  });

  it("stop marks the run stopped and later heartbeats do nothing", async () => {
    await arm();
    const stopped = await liveRunnerService.stop(account.userId, account.portfolioId);
    assert.equal(stopped?.status, "stopped");

    exchange.appendBars(SYMBOL, INTERVAL, [green(times[30])]);
    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 0);
  });

  it("concurrent heartbeats process each bar once", async () => {
      // Not gated on position size, so a bar evaluated twice produces two fills.
      const strategy = await createTestStrategy(
        account.userId,
        `export default function strategy(ctx: StrategyContext) {
          const bar = ctx.bars[ctx.bars.length - 1];
          if (bar.close > bar.open) ctx.buy({ quantity: 0.1 });
        }`,
      );
      await liveRunnerService.start(account.userId, account.portfolioId, {
        strategyId: strategy.id,
        symbol: SYMBOL,
      });
      exchange.appendBars(SYMBOL, INTERVAL, [green(times[30]), flat(times[31])]);

      await Promise.all([
        liveRunnerService.heartbeat(account.userId, account.portfolioId),
        liveRunnerService.heartbeat(account.userId, account.portfolioId),
      ]);

      const view = await liveRunnerService.getActive(account.userId, account.portfolioId);
      assert.equal(view?.trades.length, 1);
  });

  it("an error mid-tick rolls back every fill from that tick", async () => {
    const strategy = await createTestStrategy(
      account.userId,
      `export default function strategy(ctx: StrategyContext) {
        const bar = ctx.bars[ctx.bars.length - 1];
        if (ctx.bars.length === 32) throw new Error("bar 31 exploded");
        if (bar.close > bar.open && ctx.position.size === 0) ctx.buy({ quantity: 1 });
      }`,
    );
    await liveRunnerService.start(account.userId, account.portfolioId, {
      strategyId: strategy.id,
      symbol: SYMBOL,
    });
    // Bar 30 queues a buy, bar 31 fills it at its open and then throws.
    exchange.appendBars(SYMBOL, INTERVAL, [green(times[30]), flat(times[31]), flat(times[32])]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.lastError, "bar 31 exploded");
    assert.equal(view?.trades.length, 0);
    assert.equal(view?.lastProcessedBarTime, new Date(times[ARM_INDEX] * 1000).toISOString());
    assert.deepEqual(await findPositionsByPortfolioId(account.portfolioId), []);
    assert.ok(view?.logs.some((l) => l.includes("Error: bar 31 exploded")));
  });

  it("a runaway strategy is stopped by the sandbox and recorded as an error", async () => {
    const strategy = await createTestStrategy(
      account.userId,
      `export default function strategy(ctx: StrategyContext) { while (true) {} }`,
    );
    await liveRunnerService.start(account.userId, account.portfolioId, {
      strategyId: strategy.id,
      symbol: SYMBOL,
    });
    exchange.appendBars(SYMBOL, INTERVAL, [flat(times[30])]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.match(view?.lastError ?? "", /time limit/);
  });

  it("fractionOfEquity sizes against cash plus every holding", async () => {
    exchange.setTicker("ETH-USD", { bid: 1_000, ask: 1_000 });
    await tradingService.executeBuy(account.userId, account.portfolioId, {
      symbol: "ETH-USD",
      quantity: 10,
    });
    // Cash 90k + ETH 10k at cost = 100k equity → half is 50k → 500 BTC at the 100 open.
    const strategy = await createTestStrategy(
      account.userId,
      `export default function strategy(ctx: StrategyContext) {
        const bar = ctx.bars[ctx.bars.length - 1];
        if (bar.close > bar.open && ctx.position.size === 0) ctx.buy({ fractionOfEquity: 0.5 });
      }`,
    );
    await liveRunnerService.start(account.userId, account.portfolioId, {
      strategyId: strategy.id,
      symbol: SYMBOL,
    });
    exchange.appendBars(SYMBOL, INTERVAL, [green(times[30]), flat(times[31], 100)]);

    const view = await liveRunnerService.heartbeat(account.userId, account.portfolioId);
    assert.equal(view?.trades.length, 1, view?.logs.join("\n"));
    assert.equal(view?.trades[0].quantity, 500);
  });
});
