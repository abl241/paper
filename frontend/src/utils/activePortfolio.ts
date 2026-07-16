const ACTIVE_PORTFOLIO_KEY = "paper_active_portfolio_id";

export function getStoredActivePortfolioId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PORTFOLIO_KEY);
  } catch {
    return null;
  }
}

export function setStoredActivePortfolioId(id: string): void {
  localStorage.setItem(ACTIVE_PORTFOLIO_KEY, id);
}

export function clearStoredActivePortfolioId(): void {
  localStorage.removeItem(ACTIVE_PORTFOLIO_KEY);
}
