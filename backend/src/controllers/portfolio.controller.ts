import type { NextFunction, Request, Response } from "express";
import { portfolioService } from "../services/portfolio/portfolio.service.js";
import { AppError } from "../types/api.js";

export async function getPortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const portfolio = await portfolioService.getPortfolio(req.user.sub);
    res.status(200).json({ data: portfolio });
  } catch (error) {
    next(error);
  }
}
