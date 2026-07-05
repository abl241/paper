import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../../config/index.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
} from "../../models/user.model.js";
import { AppError } from "../../types/api.js";
import { portfolioService } from "../portfolio/portfolio.service.js";
import type {
  AuthResponse,
  AuthTokenPayload,
  LoginInput,
  PublicUser,
  RegisterInput,
  User,
} from "../../types/auth.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

function validateRegisterInput(input: RegisterInput): void {
  if (!USERNAME_PATTERN.test(input.username)) {
    throw new AppError(
      "Username must be 3-50 characters and contain only letters, numbers, or underscores",
      400,
      "INVALID_USERNAME",
    );
  }

  if (!EMAIL_PATTERN.test(input.email)) {
    throw new AppError("Invalid email address", 400, "INVALID_EMAIL");
  }

  if (input.password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400, "INVALID_PASSWORD");
  }
}

function createToken(user: User): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    validateRegisterInput(input);

    const email = input.email.toLowerCase();
    const username = input.username.toLowerCase();

    if (await findUserByEmail(email)) {
      throw new AppError("Email is already registered", 409, "EMAIL_EXISTS");
    }

    if (await findUserByUsername(username)) {
      throw new AppError("Username is already taken", 409, "USERNAME_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await createUser({ username, email, passwordHash });
    await portfolioService.initializeAccount(user.id);

    return {
      token: createToken(user),
      user: toPublicUser(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase().trim();
    const user = await findUserByEmail(email);

    if (!user) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    return {
      token: createToken(user),
      user: toPublicUser(user),
    };
  }

  async getUserById(id: string): Promise<PublicUser | null> {
    const user = await findUserById(id);
    return user ? toPublicUser(user) : null;
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch {
      throw new AppError("Invalid or expired token", 401, "INVALID_TOKEN");
    }
  }
}

export const authService = new AuthService();
