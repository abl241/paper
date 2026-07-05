import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { closePool, verifyDatabaseConnection } from "./config/database.js";

async function start(): Promise<void> {
  await verifyDatabaseConnection();
  console.log("[database] connected");

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[backend] listening on http://localhost:${config.port}`);
    console.log(`[backend] environment: ${config.nodeEnv}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[backend] received ${signal}, shutting down`);
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("[backend] failed to start:", err);
  process.exit(1);
});
