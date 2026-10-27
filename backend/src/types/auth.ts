export type { AuthResponse, LoginInput, PublicUser, RegisterInput } from "@paper/shared";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  email: string;
}
