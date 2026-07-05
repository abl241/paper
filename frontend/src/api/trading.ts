import { apiClient } from "./client";
import type {
  ApiResponse,
  ExecuteOrderInput,
  TradeExecutionResult,
} from "../types/trading";

export async function executeBuy(
  input: ExecuteOrderInput,
): Promise<TradeExecutionResult> {
  const { data } = await apiClient.post<ApiResponse<TradeExecutionResult>>(
    "/trading/buy",
    input,
  );
  return data.data;
}

export async function executeSell(
  input: ExecuteOrderInput,
): Promise<TradeExecutionResult> {
  const { data } = await apiClient.post<ApiResponse<TradeExecutionResult>>(
    "/trading/sell",
    input,
  );
  return data.data;
}
