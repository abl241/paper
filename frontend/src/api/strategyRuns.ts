import { apiClient } from "./client";
import type {
  ApiResponse,
  StartStrategyRunInput,
  StrategyRun,
} from "../types/strategyRun";

export async function getStrategyRun(
  portfolioId: string,
): Promise<StrategyRun | null> {
  const { data } = await apiClient.get<ApiResponse<StrategyRun | null>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/strategy-run`,
  );
  return data.data;
}

export async function startStrategyRun(
  portfolioId: string,
  input: StartStrategyRunInput,
): Promise<StrategyRun> {
  const { data } = await apiClient.post<ApiResponse<StrategyRun>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/strategy-run`,
    input,
    { timeout: 60_000 },
  );
  return data.data;
}

export async function stopStrategyRun(
  portfolioId: string,
): Promise<StrategyRun | null> {
  const { data } = await apiClient.post<ApiResponse<StrategyRun | null>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/strategy-run/stop`,
  );
  return data.data;
}

export async function heartbeatStrategyRun(
  portfolioId: string,
): Promise<StrategyRun | null> {
  const { data } = await apiClient.post<ApiResponse<StrategyRun | null>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/strategy-run/heartbeat`,
    undefined,
    { timeout: 60_000 },
  );
  return data.data;
}
