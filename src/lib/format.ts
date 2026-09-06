const HE_LOCALE = "he-IL";

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString(HE_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** DD/MM/YYYY, HH:MM — the format used everywhere in this app. */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function formatDelta(value: number | null): string {
  if (value === null) return "";
  if (Math.abs(value) < 0.005) return "\u00b10.00";
  return `${value > 0 ? "+" : "\u2212"}${Math.abs(value).toFixed(2)}`;
}

export function deltaTone(value: number | null): "flat" | "up" | "down" {
  if (value === null || Math.abs(value) < 0.005) return "flat";
  return value > 0 ? "up" : "down";
}

/** Year groups cycle through six accent tones so long degrees stay scannable. */
export function yearTone(year: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return (((year - 1) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
