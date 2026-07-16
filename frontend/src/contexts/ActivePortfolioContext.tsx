import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listPortfolios } from "../api/portfolios";
import { useAuth } from "./AuthContext";
import type { PortfolioListItem } from "../types/portfolio";
import {
  getStoredActivePortfolioId,
  setStoredActivePortfolioId,
} from "../utils/activePortfolio";

interface ActivePortfolioContextValue {
  portfolios: PortfolioListItem[];
  activePortfolioId: string | null;
  activePortfolio: PortfolioListItem | null;
  isLoading: boolean;
  error: string | null;
  refreshPortfolios: () => Promise<PortfolioListItem[]>;
  setActivePortfolioId: (id: string) => void;
}

const ActivePortfolioContext = createContext<
  ActivePortfolioContextValue | undefined
>(undefined);

export function ActivePortfolioProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [activePortfolioId, setActiveId] = useState<string | null>(
    getStoredActivePortfolioId,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPortfolios = useCallback(async () => {
    const items = await listPortfolios(false);
    setPortfolios(items);

    const stored = getStoredActivePortfolioId();
    const stillValid = items.find((item) => item.id === stored);
    const nextId = stillValid?.id ?? items[0]?.id ?? null;

    if (nextId) {
      setStoredActivePortfolioId(nextId);
      setActiveId(nextId);
    } else {
      setActiveId(null);
    }

    return items;
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setPortfolios([]);
      setActiveId(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    refreshPortfolios()
      .then(() => {
        if (!cancelled) {
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load portfolios",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, refreshPortfolios]);

  const setActivePortfolioId = useCallback((id: string) => {
    setStoredActivePortfolioId(id);
    setActiveId(id);
  }, []);

  const activePortfolio = useMemo(
    () => portfolios.find((item) => item.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId],
  );

  const value = useMemo(
    () => ({
      portfolios,
      activePortfolioId,
      activePortfolio,
      isLoading,
      error,
      refreshPortfolios,
      setActivePortfolioId,
    }),
    [
      portfolios,
      activePortfolioId,
      activePortfolio,
      isLoading,
      error,
      refreshPortfolios,
      setActivePortfolioId,
    ],
  );

  return (
    <ActivePortfolioContext.Provider value={value}>
      {children}
    </ActivePortfolioContext.Provider>
  );
}

export function useActivePortfolio(): ActivePortfolioContextValue {
  const context = useContext(ActivePortfolioContext);
  if (!context) {
    throw new Error(
      "useActivePortfolio must be used within ActivePortfolioProvider",
    );
  }
  return context;
}
