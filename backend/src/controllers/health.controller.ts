import type { Request, Response } from "express";
import type { HealthResponse } from "@paper/shared";
import { verifyDatabaseConnection } from "../config/database.js";

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  let database: HealthResponse["database"] = "ok";

  try {
    await verifyDatabaseConnection();
  } catch {
    database = "error";
  }

  const body: HealthResponse = {
    status: database === "ok" ? "ok" : "degraded",
    service: "backend",
    database,
  };

  res.status(database === "ok" ? 200 : 503).json(body);
}
