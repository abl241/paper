import { config } from "../../config/index.js";
import { AppError } from "../../types/api.js";
import { createGeminiExchange } from "./gemini/gemini.exchange.js";
import type { Exchange } from "./types.js";

export type ExchangeName = "gemini";

export function createExchange(name: ExchangeName = config.exchange as ExchangeName): Exchange {
  switch (name) {
    case "gemini":
      return createGeminiExchange(config.geminiBaseUrl);
    default:
      throw new AppError(`Unsupported exchange: ${name}`, 500, "UNSUPPORTED_EXCHANGE");
  }
}

let exchangeInstance: Exchange | undefined;

export function getExchange(): Exchange {
  if (!exchangeInstance) {
    exchangeInstance = createExchange();
  }
  return exchangeInstance;
}

export type { Exchange } from "./types.js";
