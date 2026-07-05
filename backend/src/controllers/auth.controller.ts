import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth/auth.service.js";
import { AppError } from "../types/api.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const user = await authService.getUserById(req.user.sub);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
}
