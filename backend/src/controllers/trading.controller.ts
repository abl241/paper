import type { NextFunction, Request, Response } from "express";
import { tradingService } from "../services/trading/trading.service.js";
import { AppError } from "../types/api.js";

export async function executeBuy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await tradingService.executeBuy(req.user.sub, req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function executeSell(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await tradingService.executeSell(req.user.sub, req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}
