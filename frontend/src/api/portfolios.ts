import { apiClient } from "./client";
import type {
  ApiResponse,
  PerformanceStats,
  PortfolioDetail,
  PortfolioListItem,
  PreferredExchange,
  Trade,
} from "../types/portfolio";
import type { TradeExecutionResult } from "../types/trading";

export async function listPortfolios(
  includeArchived = false,
): Promise<PortfolioListItem[]> {
  const { data } = await apiClient.get<ApiResponse<PortfolioListItem[]>>(
    "/portfolios",
    { params: { includeArchived: includeArchived ? "true" : undefined } },
  );
  return data.data;
}

export async function createPortfolio(input: {
  name: string;
  startingCash?: number;
  exchange?: PreferredExchange | null;
}): Promise<PortfolioListItem> {
  const { data } = await apiClient.post<ApiResponse<PortfolioListItem>>(
    "/portfolios",
    input,
  );
  return data.data;
}

export async function getPortfolioDetail(
  portfolioId: string,
): Promise<PortfolioDetail> {
  const { data } = await apiClient.get<ApiResponse<PortfolioDetail>>(
    `/portfolios/${encodeURIComponent(portfolioId)}`,
  );
  return data.data;
}

export async function updatePortfolio(
  portfolioId: string,
  input: { name?: string; exchange?: PreferredExchange | null },
): Promise<PortfolioListItem> {
  const { data } = await apiClient.patch<ApiResponse<PortfolioListItem>>(
    `/portfolios/${encodeURIComponent(portfolioId)}`,
    input,
  );
  return data.data;
}

export async function archivePortfolio(
  portfolioId: string,
): Promise<PortfolioListItem> {
  const { data } = await apiClient.post<ApiResponse<PortfolioListItem>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/archive`,
  );
  return data.data;
}

export async function resetPortfolio(
  portfolioId: string,
): Promise<PortfolioDetail> {
  const { data } = await apiClient.post<ApiResponse<PortfolioDetail>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/reset`,
  );
  return data.data;
}

export async function adjustFunds(
  portfolioId: string,
  input: { type: "deposit" | "withdraw"; amount: number; note?: string },
): Promise<PortfolioDetail> {
  const { data } = await apiClient.post<ApiResponse<PortfolioDetail>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/funds`,
    input,
  );
  return data.data;
}

export async function getPortfolioTrades(
  portfolioId: string,
  filters: {
    symbol?: string;
    side?: "buy" | "sell";
    from?: string;
    to?: string;
  } = {},
): Promise<Trade[]> {
  const { data } = await apiClient.get<ApiResponse<Trade[]>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/trades`,
    { params: filters },
  );
  return data.data;
}

export async function getPortfolioPerformance(
  portfolioId: string,
): Promise<PerformanceStats> {
  const { data } = await apiClient.get<ApiResponse<PerformanceStats>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/performance`,
  );
  return data.data;
}

export async function executeBuy(
  portfolioId: string,
  input: { symbol: string; quantity: number },
): Promise<TradeExecutionResult> {
  const { data } = await apiClient.post<ApiResponse<TradeExecutionResult>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/trading/buy`,
    input,
  );
  return data.data;
}

export async function executeSell(
  portfolioId: string,
  input: { symbol: string; quantity: number },
): Promise<TradeExecutionResult> {
  const { data } = await apiClient.post<ApiResponse<TradeExecutionResult>>(
    `/portfolios/${encodeURIComponent(portfolioId)}/trading/sell`,
    input,
  );
  return data.data;
}
