import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getSettings as fetchSettings,
  updateSettings as persistSettings,
} from "../api/settings";
import { useAuth } from "./AuthContext";
import type {
  PreferredExchange,
  PriceRefreshMs,
  UserSettings,
} from "../types/settings";
import {
  DEFAULT_EXCHANGE,
  DEFAULT_PRICE_REFRESH_MS,
} from "../types/settings";
import { setPreferredExchange } from "../utils/preferredExchange";
import { getLocalSettings, setLocalSettings } from "../utils/settingsStorage";

interface SettingsContextValue {
  settings: UserSettings;
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  isLoading: boolean;
  setPriceRefreshMs: (value: PriceRefreshMs) => Promise<void>;
  setExchange: (value: PreferredExchange) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

function applySettings(next: UserSettings): UserSettings {
  const normalized: UserSettings = {
    priceRefreshMs: next.priceRefreshMs ?? DEFAULT_PRICE_REFRESH_MS,
    exchange: next.exchange ?? DEFAULT_EXCHANGE,
  };
  setPreferredExchange(normalized.exchange);
  return normalized;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() =>
    applySettings(getLocalSettings()),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let cancelled = false;

    if (!isAuthenticated) {
      setSettings(applySettings(getLocalSettings()));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchSettings()
      .then((remote) => {
        if (!cancelled) {
          const normalized = applySettings(remote);
          setSettings(normalized);
          setLocalSettings(normalized);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettings(applySettings(getLocalSettings()));
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
  }, [isAuthenticated, authLoading]);

  const saveSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      const next = applySettings({ ...settings, ...partial });
      setSettings(next);
      setLocalSettings(next);

      if (isAuthenticated) {
        const saved = applySettings(await persistSettings(next));
        setSettings(saved);
        setLocalSettings(saved);
      }
    },
    [isAuthenticated, settings],
  );

  const setPriceRefreshMs = useCallback(
    async (value: PriceRefreshMs) => {
      await saveSettings({ priceRefreshMs: value });
    },
    [saveSettings],
  );

  const setExchange = useCallback(
    async (value: PreferredExchange) => {
      await saveSettings({ exchange: value });
    },
    [saveSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      priceRefreshMs: settings.priceRefreshMs ?? DEFAULT_PRICE_REFRESH_MS,
      exchange: settings.exchange ?? DEFAULT_EXCHANGE,
      isLoading,
      setPriceRefreshMs,
      setExchange,
    }),
    [settings, isLoading, setPriceRefreshMs, setExchange],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
