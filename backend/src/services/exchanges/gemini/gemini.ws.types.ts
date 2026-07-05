export interface GeminiBookTickerMessage {
  u: number;
  E: number;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
}

export interface GeminiTradeStreamMessage {
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  m: boolean;
}

export interface GeminiWsRequest {
  id: string;
  method: string;
  params: string[];
}

export interface GeminiWsResponse {
  id?: string;
  status?: number;
  result?: unknown;
  error?: {
    code: number;
    msg: string;
  };
}

export type GeminiStreamMessage =
  | GeminiBookTickerMessage
  | GeminiTradeStreamMessage
  | GeminiWsResponse;

export function isGeminiBookTickerMessage(
  message: GeminiStreamMessage,
): message is GeminiBookTickerMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "b" in message &&
    "a" in message &&
    "B" in message &&
    "A" in message
  );
}

export function isGeminiTradeStreamMessage(
  message: GeminiStreamMessage,
): message is GeminiTradeStreamMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "p" in message &&
    "q" in message &&
    "t" in message &&
    "m" in message
  );
}

export function isGeminiWsResponse(
  message: GeminiStreamMessage,
): message is GeminiWsResponse {
  return (
    typeof message === "object" &&
    message !== null &&
    ("status" in message || "error" in message || "result" in message) &&
    !("b" in message) &&
    !("p" in message)
  );
}
