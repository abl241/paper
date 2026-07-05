import axios from "axios";
import { clearStoredToken, getStoredToken } from "../utils/token";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        clearStoredToken();
      }

      const message =
        error.response?.data?.error?.message ??
        error.message ??
        "Request failed";
      return Promise.reject(new Error(message));
    }

    return Promise.reject(
      error instanceof Error ? error : new Error("Request failed"),
    );
  },
);
