import type { Request } from "express";
import { AppError } from "../types/api.js";

export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(`Missing route parameter: ${name}`, 400, "INVALID_REQUEST");
  }

  return decodeURIComponent(value);
}
