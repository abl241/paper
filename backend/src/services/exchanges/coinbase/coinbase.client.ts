import { AppError } from "../../../types/api.js";

export class CoinbaseClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      throw new AppError(
        "Failed to reach Coinbase API",
        502,
        "EXCHANGE_UNAVAILABLE",
      );
    }

    if (!response.ok) {
      const message =
        response.status === 404
          ? "Symbol not found on exchange"
          : `Coinbase API error (${response.status})`;

      throw new AppError(
        message,
        response.status === 404 ? 404 : 502,
        "EXCHANGE_ERROR",
      );
    }

    return (await response.json()) as T;
  }
}
