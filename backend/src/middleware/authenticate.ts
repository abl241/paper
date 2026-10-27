import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth/auth.service.js";
import { AppError } from "../types/api.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augments Request via this global namespace
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

/** The signed-in user's id; routes behind `authenticate` always have one. */
export function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return req.user.sub;
}
