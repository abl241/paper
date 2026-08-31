import type { Request, Response } from "express";
import { verifyDatabaseConnection } from "../config/database.js";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: "backend";
  database: "ok" | "error";
}

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
