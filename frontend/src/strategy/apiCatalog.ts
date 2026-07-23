export type ApiCategory =
  | "Orders"
  | "Market Data"
  | "Indicators"
  | "Portfolio"
  | "Utilities"
  | "Types";

export interface ApiParam {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

export interface ApiCatalogEntry {
  id: string;
  name: string;
  category: ApiCategory;
  /** Dot-path used for cursor sync, e.g. "buy", "indicator.rsi", "bars" */
  symbols: string[];
  signature: string;
  description: string;
  params: ApiParam[];
  returns: string;
  example: string;
  related: string[];
  notes?: string;
  /** Member JSDoc used when building ambient .d.ts */
  jsdoc: string;
}

export const API_CATEGORIES: ApiCategory[] = [
  "Orders",
  "Market Data",
  "Indicators",
  "Portfolio",
  "Utilities",
  "Types",
];

export const STRATEGY_API_CATALOG: ApiCatalogEntry[] = [
  {
    id: "ctx.buy",
    name: "ctx.buy",
    category: "Orders",
    symbols: ["buy"],
    signature: "buy(order?: OrderIntent): void",
    description:
      "Submit a paper buy for the strategy’s current symbol. Size from quantity, fractionOfEquity, or fractionOfCash.",
    params: [
      {
        name: "order",
        type: "OrderIntent",
        optional: true,
        description:
          "Optional sizing. If omitted, runtime may use a small default fraction of cash.",
      },
    ],
    returns: "void",
    example: `ctx.buy({ fractionOfEquity: 0.1 });`,
    related: ["ctx.sell", "OrderIntent", "ctx.cash", "ctx.equity"],
    notes:
      "Buys are long-only in the current sandbox. Insufficient cash skips the fill and logs a message.",
    jsdoc:
      "Submit a paper buy. Size via quantity, fractionOfEquity, or fractionOfCash.",
  },
  {
    id: "ctx.sell",
    name: "ctx.sell",
    category: "Orders",
    symbols: ["sell"],
    signature: "sell(order?: OrderIntent): void",
    description:
      "Reduce or close the current long position. Defaults to selling the full position size.",
    params: [
      {
        name: "order",
        type: "OrderIntent",
        optional: true,
        description: "Optional quantity. Omitting sells the entire position.",
      },
    ],
    returns: "void",
    example: `if (ctx.position.size > 0) {\n  ctx.sell();\n}`,
    related: ["ctx.buy", "ctx.position", "OrderIntent"],
    notes:
      "Selling when flat is a no-op (logged). Fraction fields on OrderIntent are ignored for sells in the current mock runtime.",
    jsdoc: "Sell some or all of the current long position.",
  },
  {
    id: "ctx.symbol",
    name: "ctx.symbol",
    category: "Market Data",
    symbols: ["symbol"],
    signature: "symbol: string",
    description: "Normalized market symbol for this strategy invocation (e.g. BTC-USD).",
    params: [],
    returns: "string",
    example: `ctx.log(\`Trading \${ctx.symbol}\`);`,
    related: ["ctx.bars", "ctx.price"],
    jsdoc: "Current market symbol for this bar evaluation.",
  },
  {
    id: "ctx.bars",
    name: "ctx.bars",
    category: "Market Data",
    symbols: ["bars"],
    signature: "bars: Bar[]",
    description:
      "Historical OHLCV bars available at the current evaluation point, oldest first.",
    params: [],
    returns: "Bar[]",
    example: `if (ctx.bars.length < 20) {\n  ctx.log("Warming up");\n  return;\n}`,
    related: ["Bar", "ctx.price", "ctx.indicator.sma"],
    notes: "Always check length before using lookback indicators.",
    jsdoc: "OHLCV bars up to the current bar (oldest first).",
  },
  {
    id: "ctx.price",
    name: "ctx.price",
    category: "Market Data",
    symbols: ["price"],
    signature: "price: number",
    description: "Latest close / mark price for the current bar.",
    params: [],
    returns: "number",
    example: `ctx.log(\`price=\${ctx.price.toFixed(2)}\`);`,
    related: ["ctx.bars", "ctx.buy"],
    jsdoc: "Latest price for the current bar.",
  },
  {
    id: "ctx.indicator.rsi",
    name: "ctx.indicator.rsi",
    category: "Indicators",
    symbols: ["rsi", "indicator.rsi"],
    signature: "rsi(bars: Bar[], period?: number): number",
    description: "Relative Strength Index on bar closes. Default period is 14.",
    params: [
      { name: "bars", type: "Bar[]", description: "Bar series (usually ctx.bars)." },
      {
        name: "period",
        type: "number",
        optional: true,
        description: "Lookback period. Defaults to 14.",
      },
    ],
    returns: "number",
    example: `const rsi = ctx.indicator.rsi(ctx.bars, 14);\nif (rsi < 30 && ctx.position.size === 0) {\n  ctx.buy({ fractionOfEquity: 0.15 });\n}`,
    related: ["ctx.bars", "ctx.buy", "ctx.indicator.sma"],
    jsdoc: "RSI on closes. Default period 14.",
  },
  {
    id: "ctx.indicator.sma",
    name: "ctx.indicator.sma",
    category: "Indicators",
    symbols: ["sma", "indicator.sma"],
    signature: "sma(bars: Bar[], period: number): number",
    description: "Simple moving average of bar closes over `period`.",
    params: [
      { name: "bars", type: "Bar[]", description: "Bar series (usually ctx.bars)." },
      { name: "period", type: "number", description: "Number of bars in the average." },
    ],
    returns: "number",
    example: `const fast = ctx.indicator.sma(ctx.bars, 10);\nconst slow = ctx.indicator.sma(ctx.bars, 30);\nif (fast > slow && ctx.position.size === 0) {\n  ctx.buy({ fractionOfCash: 0.25 });\n}`,
    related: ["ctx.indicator.ema", "ctx.bars"],
    jsdoc: "Simple moving average of closes.",
  },
  {
    id: "ctx.indicator.ema",
    name: "ctx.indicator.ema",
    category: "Indicators",
    symbols: ["ema", "indicator.ema"],
    signature: "ema(bars: Bar[], period: number): number",
    description: "Exponential moving average of bar closes over `period`.",
    params: [
      { name: "bars", type: "Bar[]", description: "Bar series (usually ctx.bars)." },
      { name: "period", type: "number", description: "EMA span." },
    ],
    returns: "number",
    example: `const ema = ctx.indicator.ema(ctx.bars, 21);\nctx.log(\`ema=\${ema.toFixed(2)}\`);`,
    related: ["ctx.indicator.sma", "ctx.indicator.macd"],
    jsdoc: "Exponential moving average of closes.",
  },
  {
    id: "ctx.indicator.macd",
    name: "ctx.indicator.macd",
    category: "Indicators",
    symbols: ["macd", "indicator.macd"],
    signature:
      "macd(bars: Bar[], fast?: number, slow?: number, signal?: number): { macd: number; signal: number; histogram: number }",
    description:
      "MACD line, signal line, and histogram. Defaults fast=12, slow=26, signal=9.",
    params: [
      { name: "bars", type: "Bar[]", description: "Bar series (usually ctx.bars)." },
      {
        name: "fast",
        type: "number",
        optional: true,
        description: "Fast EMA period (default 12).",
      },
      {
        name: "slow",
        type: "number",
        optional: true,
        description: "Slow EMA period (default 26).",
      },
      {
        name: "signal",
        type: "number",
        optional: true,
        description: "Signal EMA period (default 9).",
      },
    ],
    returns: "{ macd: number; signal: number; histogram: number }",
    example: `const { macd, signal, histogram } = ctx.indicator.macd(ctx.bars);\nif (histogram > 0 && ctx.position.size === 0) {\n  ctx.buy({ fractionOfEquity: 0.1 });\n}`,
    related: ["ctx.indicator.ema", "ctx.bars"],
    jsdoc: "MACD with optional fast/slow/signal periods (defaults 12/26/9).",
  },
  {
    id: "ctx.position",
    name: "ctx.position",
    category: "Portfolio",
    symbols: ["position"],
    signature: "position: PositionView",
    description: "Current position in the strategy symbol (size, average cost, unrealized PnL).",
    params: [],
    returns: "PositionView",
    example: `if (ctx.position.size === 0) {\n  ctx.buy({ fractionOfEquity: 0.1 });\n}`,
    related: ["PositionView", "ctx.portfolio", "ctx.sell"],
    jsdoc: "Open position for the current symbol.",
  },
  {
    id: "ctx.cash",
    name: "ctx.cash",
    category: "Portfolio",
    symbols: ["cash"],
    signature: "cash: number",
    description: "Available cash balance in the paper portfolio.",
    params: [],
    returns: "number",
    example: `ctx.log(\`cash=\${ctx.cash.toFixed(2)}\`);`,
    related: ["ctx.equity", "ctx.buy"],
    jsdoc: "Available cash balance.",
  },
  {
    id: "ctx.equity",
    name: "ctx.equity",
    category: "Portfolio",
    symbols: ["equity"],
    signature: "equity: number",
    description: "Total equity (cash plus mark-to-market positions).",
    params: [],
    returns: "number",
    example: `ctx.buy({ fractionOfEquity: 0.2 });`,
    related: ["ctx.cash", "ctx.portfolio"],
    jsdoc: "Total portfolio equity.",
  },
  {
    id: "ctx.portfolio",
    name: "ctx.portfolio",
    category: "Portfolio",
    symbols: ["portfolio"],
    signature: "portfolio: PortfolioView",
    description: "Full portfolio snapshot: cash, equity, and all open positions.",
    params: [],
    returns: "PortfolioView",
    example: `ctx.log(\`positions=\${ctx.portfolio.positions.length}\`);`,
    related: ["PortfolioView", "ctx.position", "ctx.cash"],
    jsdoc: "Full portfolio view including all positions.",
  },
  {
    id: "ctx.params",
    name: "ctx.params",
    category: "Utilities",
    symbols: ["params"],
    signature: "params: Record<string, number | string | boolean>",
    description:
      "Tunable strategy parameters from the Properties panel (e.g. fastPeriod, oversold).",
    params: [],
    returns: "Record<string, number | string | boolean>",
    example: `const period = Number(ctx.params.fastPeriod ?? 10);`,
    related: ["ctx.log"],
    notes: "Prefer Number(...) when reading numeric params — values may be typed loosely.",
    jsdoc: "User-defined strategy parameters from the Lab.",
  },
  {
    id: "ctx.log",
    name: "ctx.log",
    category: "Utilities",
    symbols: ["log"],
    signature: "log(message: string): void",
    description: "Write a message to the Strategy Lab console / dry-run logs.",
    params: [
      { name: "message", type: "string", description: "Text to append to the console." },
    ],
    returns: "void",
    example: `ctx.log(\`RSI=\${ctx.indicator.rsi(ctx.bars).toFixed(1)}\`);`,
    related: ["ctx.params"],
    jsdoc: "Append a message to strategy logs.",
  },
  {
    id: "ctx.indicator",
    name: "ctx.indicator",
    category: "Indicators",
    symbols: ["indicator"],
    signature: "indicator: Indicators",
    description: "Built-in technical indicators (rsi, sma, ema, macd).",
    params: [],
    returns: "Indicators",
    example: `const sma = ctx.indicator.sma(ctx.bars, 20);`,
    related: [
      "ctx.indicator.rsi",
      "ctx.indicator.sma",
      "ctx.indicator.ema",
      "ctx.indicator.macd",
    ],
    jsdoc: "Technical indicator helpers.",
  },
  {
    id: "Bar",
    name: "Bar",
    category: "Types",
    symbols: ["Bar"],
    signature:
      "interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }",
    description: "Single OHLCV candle. `time` is a Unix timestamp in seconds.",
    params: [],
    returns: "n/a",
    example: `const last = ctx.bars[ctx.bars.length - 1];\nctx.log(\`close=\${last.close}\`);`,
    related: ["ctx.bars"],
    jsdoc: "OHLCV bar. time is Unix seconds.",
  },
  {
    id: "OrderIntent",
    name: "OrderIntent",
    category: "Types",
    symbols: ["OrderIntent"],
    signature:
      "interface OrderIntent { symbol?: string; quantity?: number; fractionOfEquity?: number; fractionOfCash?: number }",
    description: "Optional sizing for buy/sell. Prefer one of quantity or a fraction field.",
    params: [],
    returns: "n/a",
    example: `ctx.buy({ fractionOfCash: 0.25 });`,
    related: ["ctx.buy", "ctx.sell"],
    notes: "symbol on OrderIntent is reserved; the runtime currently uses ctx.symbol.",
    jsdoc: "Optional order sizing for buy/sell.",
  },
  {
    id: "PositionView",
    name: "PositionView",
    category: "Types",
    symbols: ["PositionView"],
    signature:
      "interface PositionView { symbol: string; size: number; averageCost: number; unrealizedPnL: number }",
    description: "View of an open position.",
    params: [],
    returns: "n/a",
    example: `ctx.log(\`size=\${ctx.position.size}\`);`,
    related: ["ctx.position", "PortfolioView"],
    jsdoc: "Open position snapshot.",
  },
  {
    id: "PortfolioView",
    name: "PortfolioView",
    category: "Types",
    symbols: ["PortfolioView"],
    signature:
      "interface PortfolioView { cash: number; equity: number; positions: PositionView[] }",
    description: "Aggregate portfolio state.",
    params: [],
    returns: "n/a",
    example: `const { cash, equity } = ctx.portfolio;`,
    related: ["ctx.portfolio", "PositionView"],
    jsdoc: "Portfolio cash, equity, and positions.",
  },
  {
    id: "StrategyContext",
    name: "StrategyContext",
    category: "Types",
    symbols: ["StrategyContext", "ctx"],
    signature: "interface StrategyContext { … }",
    description:
      "Context passed to export default function strategy(ctx). Market data, portfolio, orders, and indicators.",
    params: [],
    returns: "n/a",
    example: `export default function strategy(ctx: StrategyContext) {\n  ctx.log(String(ctx.price));\n}`,
    related: ["ctx.buy", "ctx.bars", "ctx.indicator"],
    notes: "No imports, fetch, or Node APIs — only this context surface is allowed.",
    jsdoc: "Controlled API available inside strategy(ctx).",
  },
];

const CATALOG_BY_ID = new Map(
  STRATEGY_API_CATALOG.map((entry) => [entry.id, entry]),
);

/** Map cursor identifiers → catalog id (longest match preferred when resolving). */
const SYMBOL_TO_ID: { symbol: string; id: string }[] = STRATEGY_API_CATALOG.flatMap(
  (entry) => entry.symbols.map((symbol) => ({ symbol, id: entry.id })),
).sort((a, b) => b.symbol.length - a.symbol.length);

export function getApiEntry(id: string): ApiCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}

export function resolveApiIdFromToken(token: string): string | null {
  const cleaned = token.replace(/[^\w.]/g, "");
  if (!cleaned) return null;

  const direct = SYMBOL_TO_ID.find(
    (item) =>
      item.symbol === cleaned ||
      cleaned.endsWith(`.${item.symbol}`) ||
      cleaned === item.symbol,
  );
  if (direct) return direct.id;

  const parts = cleaned.split(".");
  const last = parts[parts.length - 1];
  const byLast = SYMBOL_TO_ID.find((item) => item.symbol === last);
  return byLast?.id ?? null;
}

function jsdocBlock(text: string, indent = ""): string {
  const lines = text.trim().split("\n");
  if (lines.length === 1) {
    return `${indent}/** ${lines[0]} */`;
  }
  return [
    `${indent}/**`,
    ...lines.map((line) => `${indent} * ${line}`),
    `${indent} */`,
  ].join("\n");
}

/**
 * Ambient Strategy API .d.ts with JSDoc for Monaco hover / autocomplete.
 */
export function buildStrategyApiDts(): string {
  const buy = getApiEntry("ctx.buy")!;
  const sell = getApiEntry("ctx.sell")!;
  const log = getApiEntry("ctx.log")!;
  const rsi = getApiEntry("ctx.indicator.rsi")!;
  const ema = getApiEntry("ctx.indicator.ema")!;
  const sma = getApiEntry("ctx.indicator.sma")!;
  const macd = getApiEntry("ctx.indicator.macd")!;

  return `
${jsdocBlock(getApiEntry("Bar")!.jsdoc)}
interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

${jsdocBlock(getApiEntry("PositionView")!.jsdoc)}
interface PositionView {
  symbol: string;
  size: number;
  averageCost: number;
  unrealizedPnL: number;
}

${jsdocBlock(getApiEntry("PortfolioView")!.jsdoc)}
interface PortfolioView {
  cash: number;
  equity: number;
  positions: PositionView[];
}

${jsdocBlock(getApiEntry("OrderIntent")!.jsdoc)}
interface OrderIntent {
  symbol?: string;
  quantity?: number;
  fractionOfEquity?: number;
  fractionOfCash?: number;
}

interface Indicators {
  ${jsdocBlock(rsi.jsdoc, "  ")}
  rsi(bars: Bar[], period?: number): number;
  ${jsdocBlock(ema.jsdoc, "  ")}
  ema(bars: Bar[], period: number): number;
  ${jsdocBlock(sma.jsdoc, "  ")}
  sma(bars: Bar[], period: number): number;
  ${jsdocBlock(macd.jsdoc, "  ")}
  macd(
    bars: Bar[],
    fast?: number,
    slow?: number,
    signal?: number,
  ): { macd: number; signal: number; histogram: number };
}

${jsdocBlock(getApiEntry("StrategyContext")!.jsdoc)}
interface StrategyContext {
  ${jsdocBlock(getApiEntry("ctx.symbol")!.jsdoc, "  ")}
  symbol: string;
  ${jsdocBlock(getApiEntry("ctx.bars")!.jsdoc, "  ")}
  bars: Bar[];
  ${jsdocBlock(getApiEntry("ctx.price")!.jsdoc, "  ")}
  price: number;
  ${jsdocBlock(getApiEntry("ctx.position")!.jsdoc, "  ")}
  position: PositionView;
  ${jsdocBlock(getApiEntry("ctx.cash")!.jsdoc, "  ")}
  cash: number;
  ${jsdocBlock(getApiEntry("ctx.equity")!.jsdoc, "  ")}
  equity: number;
  ${jsdocBlock(getApiEntry("ctx.portfolio")!.jsdoc, "  ")}
  portfolio: PortfolioView;
  ${jsdocBlock(getApiEntry("ctx.params")!.jsdoc, "  ")}
  params: Record<string, number | string | boolean>;
  ${jsdocBlock(buy.jsdoc, "  ")}
  buy(order?: OrderIntent): void;
  ${jsdocBlock(sell.jsdoc, "  ")}
  sell(order?: OrderIntent): void;
  ${jsdocBlock(getApiEntry("ctx.indicator")!.jsdoc, "  ")}
  indicator: Indicators;
  ${jsdocBlock(log.jsdoc, "  ")}
  log(message: string): void;
}

declare function strategy(ctx: StrategyContext): void;
`.trim();
}

export function filterCatalog(query: string): ApiCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return STRATEGY_API_CATALOG;
  return STRATEGY_API_CATALOG.filter((entry) => {
    const haystack = [
      entry.name,
      entry.id,
      entry.signature,
      entry.description,
      entry.notes ?? "",
      ...entry.symbols,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
