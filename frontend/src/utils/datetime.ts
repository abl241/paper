import type { ClockFormat } from "../types/settings";

function hour12(clockFormat: ClockFormat): boolean {
  return clockFormat === "12h";
}

export function formatDateTime(
  value: Date | string | number,
  clockFormat: ClockFormat,
): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: hour12(clockFormat),
  });
}

export function formatTime(
  value: Date | string | number,
  clockFormat: ClockFormat,
): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: hour12(clockFormat),
  });
}

export function formatChartDateTime(
  unixSeconds: number,
  clockFormat: ClockFormat,
): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: hour12(clockFormat),
  });
}
