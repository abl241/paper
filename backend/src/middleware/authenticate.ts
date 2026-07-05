import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth/auth.service.js";
import { AppError } from "../types/api.js";

declare global {
  namespace Express {
    interface Request {
      user?: import("../types/auth.js").AuthTokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const token = header.slice("Bearer ".length).trim();
    req.user = authService.verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
