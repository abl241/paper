import type { Request, Response } from "express";
import {
  createPortfolioSchema,
  fundsSchema,
  listPortfoliosQuerySchema,
  orderSchema,
  startStrategyRunSchema,
  tradesQuerySchema,
  updatePortfolioSchema,
} from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { portfolioService } from "../services/portfolio/portfolio.service.js";
import { liveRunnerService } from "../services/strategy/liveRunner.service.js";
import { tradingService } from "../services/trading/trading.service.js";
import { getRouteParam } from "../utils/params.js";
import { parseInput } from "../utils/validate.js";

export async function listPortfolios(req: Request, res: Response): Promise<void> {
  const { includeArchived } = parseInput(listPortfoliosQuerySchema, req.query);
  const data = await portfolioService.listPortfolios(
    requireUserId(req),
    includeArchived ?? false,
  );
  res.status(200).json({ data });
}

export async function createPortfolio(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.createPortfolio(
    requireUserId(req),
    parseInput(createPortfolioSchema, req.body),
  );
  res.status(201).json({ data });
}

export async function getPortfolioDetail(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.getPortfolioDetail(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function updatePortfolio(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.updatePortfolio(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(updatePortfolioSchema, req.body),
  );
  res.status(200).json({ data });
}

export async function archivePortfolio(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.archivePortfolio(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function resetPortfolio(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.resetPortfolio(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function adjustFunds(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.adjustFunds(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(fundsSchema, req.body),
  );
  res.status(200).json({ data });
}

export async function getPortfolioTrades(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.getTrades(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(tradesQuerySchema, req.query),
  );
  res.status(200).json({ data });
}

export async function getPortfolioPerformance(req: Request, res: Response): Promise<void> {
  const data = await portfolioService.getPerformance(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function executeBuy(req: Request, res: Response): Promise<void> {
  const data = await tradingService.executeBuy(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(orderSchema, req.body),
  );
  res.status(201).json({ data });
}

export async function executeSell(req: Request, res: Response): Promise<void> {
  const data = await tradingService.executeSell(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(orderSchema, req.body),
  );
  res.status(201).json({ data });
}

export async function getStrategyRun(req: Request, res: Response): Promise<void> {
  const data = await liveRunnerService.getActive(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function startStrategyRun(req: Request, res: Response): Promise<void> {
  const data = await liveRunnerService.start(
    requireUserId(req),
    getRouteParam(req, "id"),
    parseInput(startStrategyRunSchema, req.body),
  );
  res.status(201).json({ data });
}

export async function stopStrategyRun(req: Request, res: Response): Promise<void> {
  const data = await liveRunnerService.stop(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}

export async function heartbeatStrategyRun(req: Request, res: Response): Promise<void> {
  const data = await liveRunnerService.heartbeat(
    requireUserId(req),
    getRouteParam(req, "id"),
  );
  res.status(200).json({ data });
}
