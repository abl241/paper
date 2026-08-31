import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { closePool, verifyDatabaseConnection } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { runMigrations } from "./db/migrate.js";
import {
  attachWebSocketServer,
  shutdownWebSocketServer,
} from "./websocket/server.js";

async function start(): Promise<void> {
  await verifyDatabaseConnection();
  logger.info("database", "connected");

  await runMigrations();

  const app = createApp();
  const server = createServer(app);
  const wss = attachWebSocketServer(server);

  server.listen(config.port, () => {
    logger.info("backend", "listening", { port: config.port, env: config.nodeEnv });
  });

  const shutdown = async (signal: string) => {
    logger.info("backend", `received ${signal}, shutting down`);
    await shutdownWebSocketServer(wss);
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err) => {
  logger.error("backend", "failed to start", err);
  process.exit(1);
});
