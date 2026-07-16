import type { NextFunction, Request, Response } from "express";
import { portfolioService } from "../services/portfolio/portfolio.service.js";
import { tradingService } from "../services/trading/trading.service.js";
import { AppError } from "../types/api.js";
import { getRouteParam } from "../utils/params.js";

function requireUser(req: Request): string {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return req.user.sub;
}

export async function listPortfolios(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const includeArchived = req.query.includeArchived === "true";
    const data = await portfolioService.listPortfolios(userId, includeArchived);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function createPortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.createPortfolio(userId, req.body);
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.getPortfolioDetail(
      userId,
      getRouteParam(req, "id"),
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function updatePortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.updatePortfolio(
      userId,
      getRouteParam(req, "id"),
      req.body,
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function archivePortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.archivePortfolio(
      userId,
      getRouteParam(req, "id"),
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function resetPortfolio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.resetPortfolio(
      userId,
      getRouteParam(req, "id"),
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function adjustFunds(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.adjustFunds(
      userId,
      getRouteParam(req, "id"),
      req.body,
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioTrades(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const symbol =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const side =
      req.query.side === "buy" || req.query.side === "sell"
        ? req.query.side
        : undefined;
    const from =
      typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to =
      typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const data = await portfolioService.getTrades(
      userId,
      getRouteParam(req, "id"),
      { symbol, side, from, to },
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getPortfolioPerformance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await portfolioService.getPerformance(
      userId,
      getRouteParam(req, "id"),
    );
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function executeBuy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = requireUser(req);
    const data = await tradingService.executeBuy(
      userId,
      getRouteParam(req, "id"),
      req.body,
    );
    res.status(201).json({ data });
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
    const userId = requireUser(req);
    const data = await tradingService.executeSell(
      userId,
      getRouteParam(req, "id"),
      req.body,
    );
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}
