import type { Request, Response } from "express";

export interface HealthResponse {
  status: "ok";
  service: "backend";
}

export function healthCheck(_req: Request, res: Response): void {
  const body: HealthResponse = {
    status: "ok",
    service: "backend",
  };

  res.status(200).json(body);
}
