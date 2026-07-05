import { apiClient } from "./client";
import type {
  ApiResponse,
  AuthResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
} from "../types/auth";

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
    "/auth/register",
    input,
  );
  return data.data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiResponse<AuthResponse>>(
    "/auth/login",
    input,
  );
  return data.data;
}

export async function getCurrentUser(): Promise<PublicUser> {
  const { data } = await apiClient.get<ApiResponse<PublicUser>>("/auth/me");
  return data.data;
}
