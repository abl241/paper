import type { NextFunction, Request, Response } from "express";
import { strategyService } from "../services/strategy/strategy.service.js";
import { AppError } from "../types/api.js";
import { getRouteParam } from "../utils/params.js";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return req.user;
}

export async function listTemplates(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const templates = strategyService.listTemplates();
    res.status(200).json({ data: templates });
  } catch (error) {
    next(error);
  }
}

export async function listStrategies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategies = await strategyService.listStrategies(user.sub);
    res.status(200).json({ data: strategies });
  } catch (error) {
    next(error);
  }
}

export async function getStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategyId = getRouteParam(req, "strategyId");
    const strategy = await strategyService.getStrategy(user.sub, strategyId);
    res.status(200).json({ data: strategy });
  } catch (error) {
    next(error);
  }
}

export async function createStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategy = await strategyService.createStrategy(user.sub, req.body);
    res.status(201).json({ data: strategy });
  } catch (error) {
    next(error);
  }
}

export async function updateStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategyId = getRouteParam(req, "strategyId");
    const strategy = await strategyService.updateStrategy(
      user.sub,
      strategyId,
      req.body,
    );
    res.status(200).json({ data: strategy });
  } catch (error) {
    next(error);
  }
}

export async function duplicateStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategyId = getRouteParam(req, "strategyId");
    const strategy = await strategyService.duplicateStrategy(
      user.sub,
      strategyId,
    );
    res.status(201).json({ data: strategy });
  } catch (error) {
    next(error);
  }
}

export async function deleteStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategyId = getRouteParam(req, "strategyId");
    await strategyService.deleteStrategy(user.sub, strategyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function validateStrategy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireUser(req);
    const strategyId = getRouteParam(req, "strategyId");
    const result = await strategyService.validateStrategy(user.sub, strategyId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}
