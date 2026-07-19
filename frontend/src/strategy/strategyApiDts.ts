/** Ambient Strategy API types injected into Monaco. */
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
