import type { Request, Response } from "express";
import { updateSettingsSchema } from "@paper/shared/schemas";
import { requireUserId } from "../middleware/authenticate.js";
import { settingsService } from "../services/settings/settings.service.js";
import { parseInput } from "../utils/validate.js";

export async function getSettings(req: Request, res: Response): Promise<void> {
  const settings = await settingsService.getSettings(requireUserId(req));
  res.status(200).json({ data: settings });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const settings = await settingsService.updateSettings(
    requireUserId(req),
    parseInput(updateSettingsSchema, req.body),
  );
  res.status(200).json({ data: settings });
}
