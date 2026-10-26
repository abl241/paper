/**
 * Indicator helpers exposed to strategies as `ctx.indicator`.
 *
 * Must stay self-contained (no imports, no outer references): the sandbox injects
 * `indicatorLibrary.toString()` into each isolate, and the host calls it directly in tests.
 */
export function indicatorLibrary() {
  type Closeable = { close: number }[];

  function closesOf(bars: Closeable): number[] {
    return bars.map((bar) => bar.close);
  }

  function sma(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] ?? 0;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i += 1) sum += values[i];
    return sum / period;
  }

  /** EMA at every index, seeded from the first value. */
  function emaSeries(values: number[], period: number): number[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const out = [values[0]];
    for (let i = 1; i < values.length; i += 1) {
      out.push(values[i] * k + out[i - 1] * (1 - k));
    }
    return out;
  }

  function ema(values: number[], period: number): number {
    const series = emaSeries(values, period);
    return series.length > 0 ? series[series.length - 1] : 0;
  }

  function rsi(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i += 1) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    return 100 - 100 / (1 + gains / losses);
  }

  return {
    rsi: (bars: Closeable, period = 14) => rsi(closesOf(bars), period),
    ema: (bars: Closeable, period: number) => ema(closesOf(bars), period),
    sma: (bars: Closeable, period: number) => sma(closesOf(bars), period),
    macd: (bars: Closeable, fast = 12, slow = 26, signal = 9) => {
      const closes = closesOf(bars);
      const fastSeries = emaSeries(closes, fast);
      const slowSeries = emaSeries(closes, slow);
      const macdSeries = fastSeries.map((value, i) => value - slowSeries[i]);
      const macdLine = macdSeries.length > 0 ? macdSeries[macdSeries.length - 1] : 0;
      const signalLine = ema(macdSeries, signal);
      return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
    },
  };
}

export type IndicatorLibrary = ReturnType<typeof indicatorLibrary>;
