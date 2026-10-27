import type { ApiIssue } from "@paper/shared";

export type { ApiErrorBody, ApiIssue } from "@paper/shared";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly issues?: ApiIssue[];

  constructor(message: string, statusCode = 500, code?: string, issues?: ApiIssue[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.issues = issues;
  }
}
