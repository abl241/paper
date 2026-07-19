import { apiClient } from "./client";
import type {
  ApiResponse,
  CreateStrategyInput,
  StrategyDetail,
  StrategySummary,
  StrategyTemplate,
  StrategyValidationResult,
  UpdateStrategyInput,
} from "../types/strategy";

export async function listStrategyTemplates(): Promise<StrategyTemplate[]> {
  const { data } = await apiClient.get<ApiResponse<StrategyTemplate[]>>(
    "/strategies/templates",
  );
  return data.data;
}

export async function listStrategies(): Promise<StrategySummary[]> {
  const { data } = await apiClient.get<ApiResponse<StrategySummary[]>>(
    "/strategies",
  );
  return data.data;
}

export async function getStrategy(strategyId: string): Promise<StrategyDetail> {
  const { data } = await apiClient.get<ApiResponse<StrategyDetail>>(
    `/strategies/${encodeURIComponent(strategyId)}`,
  );
  return data.data;
}

export async function createStrategy(
  input: CreateStrategyInput,
): Promise<StrategyDetail> {
  const { data } = await apiClient.post<ApiResponse<StrategyDetail>>(
    "/strategies",
    input,
  );
  return data.data;
}

export async function updateStrategy(
  strategyId: string,
  input: UpdateStrategyInput,
): Promise<StrategyDetail> {
  const { data } = await apiClient.patch<ApiResponse<StrategyDetail>>(
    `/strategies/${encodeURIComponent(strategyId)}`,
    input,
  );
  return data.data;
}

export async function duplicateStrategy(
  strategyId: string,
): Promise<StrategyDetail> {
  const { data } = await apiClient.post<ApiResponse<StrategyDetail>>(
    `/strategies/${encodeURIComponent(strategyId)}/duplicate`,
  );
  return data.data;
}

export async function deleteStrategy(strategyId: string): Promise<void> {
  await apiClient.delete(`/strategies/${encodeURIComponent(strategyId)}`);
}

export async function validateStrategy(
  strategyId: string,
): Promise<StrategyValidationResult> {
  const { data } = await apiClient.post<ApiResponse<StrategyValidationResult>>(
    `/strategies/${encodeURIComponent(strategyId)}/validate`,
  );
  return data.data;
}
