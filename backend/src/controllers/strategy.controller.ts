import type { Request, Response } from "express";
import { createStrategySchema, updateStrategySchema } from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { strategyService } from "../services/strategy/strategy.service.js";
import { getRouteParam } from "../utils/params.js";
import { parseInput } from "../utils/validate.js";

export function listTemplates(_req: Request, res: Response): void {
  res.status(200).json({ data: strategyService.listTemplates() });
}

export async function listStrategies(req: Request, res: Response): Promise<void> {
  const strategies = await strategyService.listStrategies(requireUserId(req));
  res.status(200).json({ data: strategies });
}

export async function getStrategy(req: Request, res: Response): Promise<void> {
  const strategy = await strategyService.getStrategy(
    requireUserId(req),
    getRouteParam(req, "strategyId"),
  );
  res.status(200).json({ data: strategy });
}

export async function createStrategy(req: Request, res: Response): Promise<void> {
  const strategy = await strategyService.createStrategy(
    requireUserId(req),
    parseInput(createStrategySchema, req.body),
  );
  res.status(201).json({ data: strategy });
}

export async function updateStrategy(req: Request, res: Response): Promise<void> {
  const strategy = await strategyService.updateStrategy(
    requireUserId(req),
    getRouteParam(req, "strategyId"),
    parseInput(updateStrategySchema, req.body),
  );
  res.status(200).json({ data: strategy });
}

export async function duplicateStrategy(req: Request, res: Response): Promise<void> {
  const strategy = await strategyService.duplicateStrategy(
    requireUserId(req),
    getRouteParam(req, "strategyId"),
  );
  res.status(201).json({ data: strategy });
}

export async function deleteStrategy(req: Request, res: Response): Promise<void> {
  await strategyService.deleteStrategy(requireUserId(req), getRouteParam(req, "strategyId"));
  res.status(204).send();
}

export async function validateStrategy(req: Request, res: Response): Promise<void> {
  const result = await strategyService.validateStrategy(
    requireUserId(req),
    getRouteParam(req, "strategyId"),
  );
  res.status(200).json({ data: result });
}
