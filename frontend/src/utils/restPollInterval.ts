/** REST polling cadence — realtime (0) still needs a sane minimum for HTTP. */
export function restPollIntervalMs(priceRefreshMs: number): number {
  return priceRefreshMs > 0 ? priceRefreshMs : 1_000;
}
