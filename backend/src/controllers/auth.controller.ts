import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { authService } from "../services/auth/auth.service.js";
import { AppError } from "../types/api.js";
import { parseInput } from "../utils/validate.js";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(parseInput(registerSchema, req.body));
  res.status(201).json({ data: result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(parseInput(loginSchema, req.body));
  res.status(200).json({ data: result });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getUserById(requireUserId(req));
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  res.status(200).json({ data: user });
}
