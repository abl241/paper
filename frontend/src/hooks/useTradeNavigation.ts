import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useActivePortfolio } from "../contexts/ActivePortfolioContext";
import { buildTradePath, getTradeHref } from "../utils/tradeHref";

export function useTradeNavigation() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { activePortfolioId } = useActivePortfolio();

  return useCallback(
    (symbol?: string, side?: "buy" | "sell") => {
      const href = activePortfolioId
        ? buildTradePath(activePortfolioId, symbol, side)
        : getTradeHref(symbol, side);

      if (!isAuthenticated) {
        navigate("/login", { state: { from: href } });
        return;
      }

      navigate(href);
    },
    [activePortfolioId, isAuthenticated, navigate],
  );
}
