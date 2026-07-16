import { Navigate, useSearchParams } from "react-router-dom";
import { useActivePortfolio } from "../contexts/ActivePortfolioContext";
import { buildTradePath } from "../utils/tradeHref";

/** Legacy /trade → active portfolio trade section. */
export default function TradeRedirect() {
  const [searchParams] = useSearchParams();
  const { activePortfolioId, isLoading } = useActivePortfolio();

  if (isLoading) {
    return <p>Redirecting…</p>;
  }

  const symbol = searchParams.get("symbol") ?? undefined;
  const side =
    searchParams.get("side") === "buy" || searchParams.get("side") === "sell"
      ? searchParams.get("side")
      : undefined;

  if (!activePortfolioId) {
    return <Navigate to="/portfolio" replace />;
  }

  return (
    <Navigate
      to={buildTradePath(
        activePortfolioId,
        symbol ?? undefined,
        side as "buy" | "sell" | undefined,
      )}
      replace
    />
  );
}
