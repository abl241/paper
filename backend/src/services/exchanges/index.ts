import { config } from "../../config/index.js";
import { AppError } from "../../types/api.js";
import { createCoinbaseExchange } from "./coinbase/coinbase.exchange.js";
import { createGeminiExchange } from "./gemini/gemini.exchange.js";
import type { Exchange } from "./types.js";

export const EXCHANGE_NAMES = ["gemini", "coinbase"] as const;
export type ExchangeName = (typeof EXCHANGE_NAMES)[number];

export function isExchangeName(value: unknown): value is ExchangeName {
  return (
    typeof value === "string" &&
    (EXCHANGE_NAMES as readonly string[]).includes(value)
  );
}

export function parseExchangeName(
  value: unknown,
  fallback: ExchangeName = config.exchange as ExchangeName,
): ExchangeName {
  if (isExchangeName(value)) {
    return value;
  }
  if (isExchangeName(fallback)) {
    return fallback;
  }
  return "gemini";
}

export function createExchange(name: ExchangeName): Exchange {
  switch (name) {
    case "gemini":
      return createGeminiExchange(config.geminiBaseUrl);
    case "coinbase":
      return createCoinbaseExchange(config.coinbaseBaseUrl);
    default:
      throw new AppError(`Unsupported exchange: ${name}`, 500, "UNSUPPORTED_EXCHANGE");
  }
}

const exchangeInstances = new Map<ExchangeName, Exchange>();

export function getExchange(name?: ExchangeName | string): Exchange {
  const resolved = parseExchangeName(name ?? config.exchange);
  let instance = exchangeInstances.get(resolved);
  if (!instance) {
    instance = createExchange(resolved);
    exchangeInstances.set(resolved, instance);
  }
  return instance;
}

export type { Exchange } from "./types.js";
