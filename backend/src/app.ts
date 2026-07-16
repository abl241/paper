import cors from "cors";
import express from "express";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import routes from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
