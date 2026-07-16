import type { Request, Response, NextFunction } from "express";
import { parseExchangeName } from "../services/exchanges/index.js";
import { marketService } from "../services/market/market.service.js";
import { AppError } from "../types/api.js";
import { getRouteParam } from "../utils/params.js";

const ALLOWED_INTERVALS = new Set(["1h", "6h", "1d"]);

function exchangeFromRequest(req: Request): string {
  return parseExchangeName(req.query.exchange);
}

export async function listSymbols(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const symbols = await marketService.listSymbols(exchangeFromRequest(req));
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
    const ticker = await marketService.getTicker(
      getRouteParam(req, "symbol"),
      exchangeFromRequest(req),
    );
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
    const orderBook = await marketService.getOrderBook(
      getRouteParam(req, "symbol"),
      exchangeFromRequest(req),
    );
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
    const trades = await marketService.getTrades(
      getRouteParam(req, "symbol"),
      exchangeFromRequest(req),
    );
    res.status(200).json({ data: trades });
  } catch (error) {
    next(error);
  }
}

export async function getCandles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const interval =
      typeof req.query.interval === "string" ? req.query.interval : "1h";

    if (!ALLOWED_INTERVALS.has(interval)) {
      throw new AppError(
        "Invalid interval. Supported values: 1h, 6h, 1d",
        400,
        "INVALID_INTERVAL",
      );
    }

    const candles = await marketService.getCandles(
      getRouteParam(req, "symbol"),
      interval,
      exchangeFromRequest(req),
    );

    const sorted = [...candles].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    res.status(200).json({ data: sorted });
  } catch (error) {
    next(error);
  }
}
