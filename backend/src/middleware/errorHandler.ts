import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../types/api.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  logger.error("http", "unhandled error", err);

  res.status(500).json({
    error: {
      message: config.isProd ? "Internal server error" : String(err),
      code: "INTERNAL_ERROR",
    },
  });
}
