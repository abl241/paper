import type { Request, Response } from "express";
import { addWatchlistItemSchema } from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { watchlistService } from "../services/watchlist/watchlist.service.js";
import { getRouteParam } from "../utils/params.js";
import { parseInput } from "../utils/validate.js";

export async function getWatchlist(req: Request, res: Response): Promise<void> {
  const watchlist = await watchlistService.getWatchlist(requireUserId(req));
  res.status(200).json({ data: watchlist });
}

export async function addWatchlistItem(req: Request, res: Response): Promise<void> {
  const { symbol } = parseInput(addWatchlistItemSchema, req.body);
  const watchlist = await watchlistService.addSymbol(requireUserId(req), symbol);
  res.status(201).json({ data: watchlist });
}

export async function removeWatchlistItem(req: Request, res: Response): Promise<void> {
  const watchlist = await watchlistService.removeSymbol(
    requireUserId(req),
    getRouteParam(req, "symbol"),
  );
  res.status(200).json({ data: watchlist });
}
