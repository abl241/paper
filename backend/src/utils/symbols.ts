const SYMBOL_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+$/;

const QUOTE_CURRENCIES = [
  "usdc",
  "usdt",
  "gusd",
  "rlusd",
  "sgd",
  "gbp",
  "eur",
  "btc",
  "eth",
  "usd",
] as const;

export function toGeminiSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(normalized)) {
    throw new Error(`Invalid symbol format: ${symbol}. Expected format: BTC-USD`);
  }

  return normalized.replace("-", "").toLowerCase();
}

export function fromGeminiSymbol(geminiSymbol: string): string {
  const normalized = geminiSymbol.trim().toLowerCase();

  if (!normalized) {
    throw new Error(`Invalid Gemini symbol: ${geminiSymbol}`);
  }

  for (const quote of QUOTE_CURRENCIES) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      const base = normalized.slice(0, -quote.length);
      return `${base.toUpperCase()}-${quote.toUpperCase()}`;
    }
  }

  throw new Error(`Unable to parse Gemini symbol: ${geminiSymbol}`);
}

export function normalizeSymbol(symbol: string): string {
  if (symbol.includes("-")) {
    return symbol.trim().toUpperCase();
  }

  return fromGeminiSymbol(symbol);
}
