import type { NextFunction, Request, Response } from "express";
import { researchService } from "../services/research/research.service.js";
import { AppError } from "../types/api.js";
import { getRouteParam } from "../utils/params.js";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return req.user;
}

export async function listBacktests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const data = await researchService.listBacktests(user.sub);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getBacktest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const backtestId = getRouteParam(req, "backtestId");
    const data = await researchService.getBacktest(user.sub, backtestId);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
}

export async function createBacktest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    if (!req.body?.strategyId || typeof req.body.strategyId !== "string") {
      throw new AppError("strategyId is required", 400, "INVALID_REQUEST");
    }
    const data = await researchService.runBacktest(user.sub, {
      strategyId: req.body.strategyId,
      symbol: req.body.symbol,
      range: req.body.range,
      feeBps: req.body.feeBps,
      exchange: req.body.exchange,
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
}
