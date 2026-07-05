import { apiClient } from "./client";
import type { ApiResponse, Portfolio } from "../types/portfolio";

export async function getPortfolio(): Promise<Portfolio> {
  const { data } = await apiClient.get<ApiResponse<Portfolio>>("/portfolio");
  return data.data;
}
