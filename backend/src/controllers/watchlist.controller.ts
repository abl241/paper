import type { NextFunction, Request, Response } from "express";
import { watchlistService } from "../services/watchlist/watchlist.service.js";
import { AppError } from "../types/api.js";
import { getRouteParam } from "../utils/params.js";

export async function getWatchlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const watchlist = await watchlistService.getWatchlist(req.user.sub);
    res.status(200).json({ data: watchlist });
  } catch (error) {
    next(error);
  }
}

export async function addWatchlistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const watchlist = await watchlistService.addSymbol(req.user.sub, req.body.symbol);
    res.status(201).json({ data: watchlist });
  } catch (error) {
    next(error);
  }
}

export async function removeWatchlistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const symbol = getRouteParam(req, "symbol");
    const watchlist = await watchlistService.removeSymbol(req.user.sub, symbol);
    res.status(200).json({ data: watchlist });
  } catch (error) {
    next(error);
  }
}
