import type { NextFunction, Request, Response } from "express";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { AppError, type ApiErrorBody } from "../types/api.js";

/** body-parser and other http-errors style failures carry their own 4xx status. */
function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500 ? status : null;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err.issues ? { issues: err.issues } : {}),
      },
    });
    return;
  }

  const clientStatus = clientErrorStatus(err);
  if (clientStatus !== null) {
    res.status(clientStatus).json({
      error: {
        message: clientStatus === 400 ? "Malformed request body" : "Request rejected",
        code: "INVALID_REQUEST",
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
