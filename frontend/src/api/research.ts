import { apiClient } from "./client";
import type {
  ApiResponse,
  BacktestDetail,
  BacktestSummary,
  CreateBacktestInput,
} from "../types/research";

export async function listBacktests(): Promise<BacktestSummary[]> {
  const { data } = await apiClient.get<ApiResponse<BacktestSummary[]>>(
    "/research/backtests",
  );
  return data.data;
}

export async function getBacktest(backtestId: string): Promise<BacktestDetail> {
  const { data } = await apiClient.get<ApiResponse<BacktestDetail>>(
    `/research/backtests/${encodeURIComponent(backtestId)}`,
  );
  return data.data;
}

export async function createBacktest(
  input: CreateBacktestInput,
): Promise<BacktestDetail> {
  const { data } = await apiClient.post<ApiResponse<BacktestDetail>>(
    "/research/backtests",
    input,
    { timeout: 60_000 },
  );
  return data.data;
}
