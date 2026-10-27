import type { Request, Response } from "express";
import { createBacktestSchema } from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { researchService } from "../services/research/research.service.js";
import { getRouteParam } from "../utils/params.js";
import { parseInput } from "../utils/validate.js";

export async function listBacktests(req: Request, res: Response): Promise<void> {
  const data = await researchService.listBacktests(requireUserId(req));
  res.status(200).json({ data });
}

export async function getBacktest(req: Request, res: Response): Promise<void> {
  const data = await researchService.getBacktest(
    requireUserId(req),
    getRouteParam(req, "backtestId"),
  );
  res.status(200).json({ data });
}

export async function createBacktest(req: Request, res: Response): Promise<void> {
  const data = await researchService.runBacktest(
    requireUserId(req),
    parseInput(createBacktestSchema, req.body),
  );
  res.status(201).json({ data });
}
