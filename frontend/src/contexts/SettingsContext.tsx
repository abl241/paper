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
  ClockFormat,
  EquityDefaultRange,
  EquityResolution,
  EquityYAxis,
  PreferredExchange,
  PriceRefreshMs,
  UserSettings,
} from "../types/settings";
import {
  DEFAULT_CLOCK_FORMAT,
  DEFAULT_EQUITY_DEFAULT_RANGE,
  DEFAULT_EQUITY_RESOLUTION,
  DEFAULT_EQUITY_Y_AXIS,
  DEFAULT_EXCHANGE,
  DEFAULT_PRICE_REFRESH_MS,
} from "../types/settings";
import { setPreferredExchange } from "../utils/preferredExchange";
import { getLocalSettings, setLocalSettings } from "../utils/settingsStorage";

interface SettingsContextValue {
  settings: UserSettings;
  priceRefreshMs: PriceRefreshMs;
  exchange: PreferredExchange;
  equityResolution: EquityResolution;
  equityYAxis: EquityYAxis;
  equityDefaultRange: EquityDefaultRange;
  clockFormat: ClockFormat;
  isLoading: boolean;
  setPriceRefreshMs: (value: PriceRefreshMs) => Promise<void>;
  setExchange: (value: PreferredExchange) => Promise<void>;
  setEquityResolution: (value: EquityResolution) => Promise<void>;
  setEquityYAxis: (value: EquityYAxis) => Promise<void>;
  setEquityDefaultRange: (value: EquityDefaultRange) => Promise<void>;
  setClockFormat: (value: ClockFormat) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

function applySettings(next: UserSettings): UserSettings {
  const normalized: UserSettings = {
    priceRefreshMs: next.priceRefreshMs ?? DEFAULT_PRICE_REFRESH_MS,
    exchange: next.exchange ?? DEFAULT_EXCHANGE,
    equityResolution: next.equityResolution ?? DEFAULT_EQUITY_RESOLUTION,
    equityYAxis: next.equityYAxis ?? DEFAULT_EQUITY_Y_AXIS,
    equityDefaultRange: next.equityDefaultRange ?? DEFAULT_EQUITY_DEFAULT_RANGE,
    clockFormat: next.clockFormat ?? DEFAULT_CLOCK_FORMAT,
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

  const setEquityResolution = useCallback(
    async (value: EquityResolution) => {
      await saveSettings({ equityResolution: value });
    },
    [saveSettings],
  );

  const setEquityYAxis = useCallback(
    async (value: EquityYAxis) => {
      await saveSettings({ equityYAxis: value });
    },
    [saveSettings],
  );

  const setEquityDefaultRange = useCallback(
    async (value: EquityDefaultRange) => {
      await saveSettings({ equityDefaultRange: value });
    },
    [saveSettings],
  );

  const setClockFormat = useCallback(
    async (value: ClockFormat) => {
      await saveSettings({ clockFormat: value });
    },
    [saveSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      priceRefreshMs: settings.priceRefreshMs ?? DEFAULT_PRICE_REFRESH_MS,
      exchange: settings.exchange ?? DEFAULT_EXCHANGE,
      equityResolution: settings.equityResolution ?? DEFAULT_EQUITY_RESOLUTION,
      equityYAxis: settings.equityYAxis ?? DEFAULT_EQUITY_Y_AXIS,
      equityDefaultRange:
        settings.equityDefaultRange ?? DEFAULT_EQUITY_DEFAULT_RANGE,
      clockFormat: settings.clockFormat ?? DEFAULT_CLOCK_FORMAT,
      isLoading,
      setPriceRefreshMs,
      setExchange,
      setEquityResolution,
      setEquityYAxis,
      setEquityDefaultRange,
      setClockFormat,
    }),
    [
      settings,
      isLoading,
      setPriceRefreshMs,
      setExchange,
      setEquityResolution,
      setEquityYAxis,
      setEquityDefaultRange,
      setClockFormat,
    ],
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
