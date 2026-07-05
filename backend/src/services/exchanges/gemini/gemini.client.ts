import { AppError } from "../../../types/api.js";

export class GeminiClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new AppError("Failed to reach Gemini API", 502, "EXCHANGE_UNAVAILABLE");
    }

    if (!response.ok) {
      const message =
        response.status === 404
          ? "Symbol not found on exchange"
          : `Gemini API error (${response.status})`;

      throw new AppError(message, response.status === 404 ? 404 : 502, "EXCHANGE_ERROR");
    }

    return (await response.json()) as T;
  }
}
