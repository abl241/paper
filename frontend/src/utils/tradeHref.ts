import { getStoredActivePortfolioId } from "./activePortfolio";

export function buildTradePath(
  portfolioId: string,
  symbol?: string,
  side?: "buy" | "sell",
): string {
  const params = new URLSearchParams();
  if (symbol) {
    params.set("symbol", symbol);
  }
  if (side) {
    params.set("side", side);
  }
  const query = params.toString();
  return `/portfolio/${encodeURIComponent(portfolioId)}/trade${query ? `?${query}` : ""}`;
}

/** Resolve trade href using stored active portfolio; falls back to /portfolio. */
export function getTradeHref(symbol?: string, side?: "buy" | "sell"): string {
  const id = getStoredActivePortfolioId();
  if (!id) {
    const params = new URLSearchParams();
    if (symbol) params.set("symbol", symbol);
    if (side) params.set("side", side);
    const query = params.toString();
    return `/portfolio${query ? `?${query}` : ""}`;
  }
  return buildTradePath(id, symbol, side);
}
