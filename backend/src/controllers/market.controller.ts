import type { Request, Response } from "express";
import {
  candlesQuerySchema,
  exchangeQuerySchema,
  summariesQuerySchema,
} from "@paper/shared/schemas";
import { parseExchangeName } from "../services/exchanges/index.js";
import { marketService } from "../services/market/market.service.js";
import { getRouteParam } from "../utils/params.js";
import { parseInput } from "../utils/validate.js";

function exchangeFromRequest(req: Request): string {
  return parseExchangeName(parseInput(exchangeQuerySchema, req.query).exchange);
}

export async function listSymbols(req: Request, res: Response): Promise<void> {
  const symbols = await marketService.listSymbols(exchangeFromRequest(req));
  res.status(200).json({ data: symbols });
}

export async function getSummaries(req: Request, res: Response): Promise<void> {
  const { exchange, quote, symbols, limit, offset } = parseInput(
    summariesQuerySchema,
    req.query,
  );
  const result = await marketService.getSummaries({
    exchange: parseExchangeName(exchange),
    quote,
    symbols,
    limit,
    offset,
  });
  res.status(200).json({ data: result });
}

export async function getTicker(req: Request, res: Response): Promise<void> {
  const ticker = await marketService.getTicker(
    getRouteParam(req, "symbol"),
    exchangeFromRequest(req),
  );
  res.status(200).json({ data: ticker });
}

export async function getOrderBook(req: Request, res: Response): Promise<void> {
  const orderBook = await marketService.getOrderBook(
    getRouteParam(req, "symbol"),
    exchangeFromRequest(req),
  );
  res.status(200).json({ data: orderBook });
}

export async function getTrades(req: Request, res: Response): Promise<void> {
  const trades = await marketService.getTrades(
    getRouteParam(req, "symbol"),
    exchangeFromRequest(req),
  );
  res.status(200).json({ data: trades });
}

export async function getCandles(req: Request, res: Response): Promise<void> {
  const { exchange, interval, history } = parseInput(candlesQuerySchema, req.query);
  const candles = await marketService.getCandles(
    getRouteParam(req, "symbol"),
    interval,
    parseExchangeName(exchange),
    { fullHistory: history ?? false },
  );

  const sorted = [...candles].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  res.status(200).json({ data: sorted });
}
