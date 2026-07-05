import type { Request, Response, NextFunction } from "express";
import { marketService } from "../services/market/market.service.js";
import { getRouteParam } from "../utils/params.js";

export async function listSymbols(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbols = await marketService.listSymbols();
    res.status(200).json({ data: symbols });
  } catch (error) {
    next(error);
  }
}

export async function getTicker(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ticker = await marketService.getTicker(getRouteParam(req, "symbol"));
    res.status(200).json({ data: ticker });
  } catch (error) {
    next(error);
  }
}

export async function getOrderBook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const orderBook = await marketService.getOrderBook(getRouteParam(req, "symbol"));
    res.status(200).json({ data: orderBook });
  } catch (error) {
    next(error);
  }
}

export async function getTrades(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const trades = await marketService.getTrades(getRouteParam(req, "symbol"));
    res.status(200).json({ data: trades });
  } catch (error) {
    next(error);
  }
}
