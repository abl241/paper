import { config } from "../config/index.js";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  error?: string;
}

function serializeError(err: unknown): string | undefined {
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  if (err !== undefined) {
    return String(err);
  }
  return undefined;
}

function write(entry: LogEntry): void {
  const line = config.isProd
    ? JSON.stringify(entry)
    : `[${entry.scope}] ${entry.level}: ${entry.message}${
        entry.meta ? ` ${JSON.stringify(entry.meta)}` : ""
      }${entry.error ? `\n${entry.error}` : ""}`;

  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  error(scope: string, message: string, err?: unknown, meta?: Record<string, unknown>): void {
    write({
      level: "error",
      scope,
      message,
      timestamp: new Date().toISOString(),
      meta,
      error: serializeError(err),
    });
  },

  warn(scope: string, message: string, meta?: Record<string, unknown>): void {
    write({
      level: "warn",
      scope,
      message,
      timestamp: new Date().toISOString(),
      meta,
    });
  },

  info(scope: string, message: string, meta?: Record<string, unknown>): void {
    write({
      level: "info",
      scope,
      message,
      timestamp: new Date().toISOString(),
      meta,
    });
  },

  debug(scope: string, message: string, meta?: Record<string, unknown>): void {
    if (config.isProd) {
      return;
    }
    write({
      level: "debug",
      scope,
      message,
      timestamp: new Date().toISOString(),
      meta,
    });
  },
};
