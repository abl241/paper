import { randomUUID } from "node:crypto";
import { createStrategy } from "../../src/models/strategy.model.js";
import { authService } from "../../src/services/auth/auth.service.js";
import { portfolioService } from "../../src/services/portfolio/portfolio.service.js";
import type { StrategyParams } from "../../src/services/strategy/runtime.js";
import type { StrategyTimeframe } from "../../src/types/strategy.js";

export interface TestAccount {
  userId: string;
  portfolioId: string;
  token: string;
}

/** Register through the real auth path (user + default portfolio + settings). */
export async function createAccount(): Promise<TestAccount> {
  const suffix = randomUUID().slice(0, 8);
  const { token, user } = await authService.register({
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: "password123",
  });
  const portfolio = await portfolioService.ensureDefaultPortfolio(user.id);
  return { userId: user.id, portfolioId: portfolio.id, token };
}

export async function createTestStrategy(
  userId: string,
  sourceCode: string,
  options: { timeframe?: StrategyTimeframe; params?: StrategyParams; symbols?: string[] } = {},
) {
  return createStrategy({
    userId,
    name: `strategy_${randomUUID().slice(0, 8)}`,
    description: "",
    sourceCode,
    tags: [],
    symbols: options.symbols ?? ["BTC-USD"],
    exchange: null,
    timeframe: options.timeframe ?? "1h",
    startingCapital: 100_000,
    params: options.params ?? {},
    risk: {},
    notes: "",
  });
}

/** Hourly bar open times ending well before now, so every bar counts as closed. */
export function hourlyTimes(count: number, hoursAgoStart = 100): number[] {
  const hour = 3600;
  const start = Math.floor(Date.now() / 1000 / hour) * hour - hoursAgoStart * hour;
  return Array.from({ length: count }, (_, i) => start + i * hour);
}
