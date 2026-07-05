import type { TickerUpdate, TradeUpdate } from "../../../types/websocket.js";
import { fromGeminiSymbol, normalizeSymbol } from "../../../utils/symbols.js";
import type {
  GeminiBookTickerMessage,
  GeminiTradeStreamMessage,
} from "./gemini.ws.types.js";

function parseNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}: ${value}`);
  }
  return parsed;
}

function normalizeGeminiStreamSymbol(geminiSymbol: string): string {
  try {
    return fromGeminiSymbol(geminiSymbol);
  } catch {
    return normalizeSymbol(geminiSymbol.replace(/-/g, ""));
  }
}

function eventTimestamp(eventTime: number): string {
  const milliseconds = eventTime > 1_000_000_000_000_000 ? eventTime / 1_000_000 : eventTime;
  return new Date(milliseconds).toISOString();
}

export function mapGeminiBookTicker(message: GeminiBookTickerMessage): TickerUpdate {
  const bid = parseNumber(message.b, "bid");
  const ask = parseNumber(message.a, "ask");

  return {
    symbol: normalizeGeminiStreamSymbol(message.s),
    bid,
    ask,
    last: (bid + ask) / 2,
    timestamp: eventTimestamp(message.E),
  };
}

export function mapGeminiTradeStream(message: GeminiTradeStreamMessage): TradeUpdate {
  return {
    symbol: normalizeGeminiStreamSymbol(message.s),
    price: parseNumber(message.p, "price"),
    quantity: parseNumber(message.q, "quantity"),
    side: message.m ? "sell" : "buy",
    timestamp: eventTimestamp(message.E),
  };
}

export function toGeminiBookTickerStream(symbol: string): string {
  return `${symbol.toLowerCase()}@bookTicker`;
}

export function toGeminiTradeStream(symbol: string): string {
  return `${symbol.toLowerCase()}@trade`;
}
