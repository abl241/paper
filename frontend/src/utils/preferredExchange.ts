import type { PreferredExchange } from "../types/settings";
import { DEFAULT_EXCHANGE } from "../types/settings";

let preferredExchange: PreferredExchange = DEFAULT_EXCHANGE;

export function setPreferredExchange(exchange: PreferredExchange): void {
  preferredExchange = exchange;
}

export function getPreferredExchange(): PreferredExchange {
  return preferredExchange;
}
