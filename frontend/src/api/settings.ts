import { apiClient } from "./client";
import type { ApiResponse, UserSettings } from "../types/settings";

export async function getSettings(): Promise<UserSettings> {
  const { data } = await apiClient.get<ApiResponse<UserSettings>>("/settings");
  return data.data;
}

export async function updateSettings(
  settings: UserSettings,
): Promise<UserSettings> {
  const { data } = await apiClient.patch<ApiResponse<UserSettings>>(
    "/settings",
    settings,
  );
  return data.data;
}
