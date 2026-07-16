import type { NextFunction, Request, Response } from "express";
import { settingsService } from "../services/settings/settings.service.js";
import { AppError } from "../types/api.js";

export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const settings = await settingsService.getSettings(req.user.sub);
    res.status(200).json({ data: settings });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const settings = await settingsService.updateSettings(req.user.sub, req.body);
    res.status(200).json({ data: settings });
  } catch (error) {
    next(error);
  }
}
