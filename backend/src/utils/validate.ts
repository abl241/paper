import type { z } from "zod";
import { AppError } from "../types/api.js";

/**
 * Parse untrusted input (a request body or query) with a shared schema.
 * Failures become a 400 INVALID_REQUEST listing every bad field.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {}, {
    error: (issue) => (issue.input === undefined ? "Required" : undefined),
  });
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
  const [first] = issues;
  const message = first.path ? `${first.path}: ${first.message}` : first.message;
  throw new AppError(message, 400, "INVALID_REQUEST", issues);
}
