/**
 * Controlled Strategy API — strategies talk only to this surface.
 * Shared conceptually with Research (backtest / live paper) later.
 */

export const STRATEGY_API_DTS = `
interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PositionView {
  symbol: string;
  size: number;
  averageCost: number;
  unrealizedPnL: number;
}

interface PortfolioView {
  cash: number;
  equity: number;
  positions: PositionView[];
}

interface OrderIntent {
  symbol?: string;
  quantity?: number;
  fractionOfEquity?: number;
  fractionOfCash?: number;
}

interface Indicators {
  rsi(bars: Bar[], period?: number): number;
  ema(bars: Bar[], period: number): number;
  sma(bars: Bar[], period: number): number;
  macd(
    bars: Bar[],
    fast?: number,
    slow?: number,
    signal?: number,
  ): { macd: number; signal: number; histogram: number };
}

interface StrategyContext {
  symbol: string;
  bars: Bar[];
  price: number;
  position: PositionView;
  cash: number;
  equity: number;
  portfolio: PortfolioView;
  params: Record<string, number | string | boolean>;
  buy(order?: OrderIntent): void;
  sell(order?: OrderIntent): void;
  indicator: Indicators;
  log(message: string): void;
}

declare function strategy(ctx: StrategyContext): void;
`.trim();

export const BLANK_STRATEGY_SOURCE = `/**
 * Strategy Lab — TypeScript strategy.
 * Use only the StrategyContext API (buy/sell/indicators). No imports.
 */
export default function strategy(ctx: StrategyContext) {
  const { bars, price, position, params } = ctx;

  if (bars.length < 20) {
    ctx.log("Warming up — need more bars");
    return;
  }

  const fast = ctx.indicator.sma(bars, Number(params.fastPeriod ?? 10));
  const slow = ctx.indicator.sma(bars, Number(params.slowPeriod ?? 20));

  ctx.log(\`price=\${price.toFixed(2)} fast=\${fast.toFixed(2)} slow=\${slow.toFixed(2)}\`);

  if (fast > slow && position.size === 0) {
    ctx.buy({ fractionOfEquity: 0.1 });
  } else if (fast < slow && position.size > 0) {
    ctx.sell();
  }
}
`;

export const RSI_MEAN_REVERSION_SOURCE = `/**
 * RSI mean reversion — buy oversold, sell overbought.
 */
export default function strategy(ctx: StrategyContext) {
  const period = Number(ctx.params.rsiPeriod ?? 14);
  const oversold = Number(ctx.params.oversold ?? 30);
  const overbought = Number(ctx.params.overbought ?? 70);

  if (ctx.bars.length < period + 1) {
    ctx.log("Warming up");
    return;
  }

  const rsi = ctx.indicator.rsi(ctx.bars, period);
  ctx.log(\`RSI=\${rsi.toFixed(1)}\`);

  if (rsi < oversold && ctx.position.size === 0) {
    ctx.buy({ fractionOfEquity: 0.15 });
  } else if (rsi > overbought && ctx.position.size > 0) {
    ctx.sell();
  }
}
`;

export const SMA_CROSS_SOURCE = `/**
 * Classic SMA crossover.
 */
export default function strategy(ctx: StrategyContext) {
  const fastPeriod = Number(ctx.params.fastPeriod ?? 10);
  const slowPeriod = Number(ctx.params.slowPeriod ?? 30);

  if (ctx.bars.length < slowPeriod) {
    ctx.log("Warming up");
    return;
  }

  const fast = ctx.indicator.sma(ctx.bars, fastPeriod);
  const slow = ctx.indicator.sma(ctx.bars, slowPeriod);

  if (fast > slow && ctx.position.size === 0) {
    ctx.buy({ fractionOfCash: 0.25 });
    ctx.log("Golden cross — entered long");
  } else if (fast < slow && ctx.position.size > 0) {
    ctx.sell();
    ctx.log("Death cross — exited");
  }
}
`;
