export interface HealthResponse {
  status: "ok" | "degraded";
  service: "backend";
  database: "ok" | "error";
}
