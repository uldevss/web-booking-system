import { siteConfig } from "./config";

// Display helpers. Locale and time zone are pinned so server-rendered and
// client-rendered output match (no hydration mismatches) and every viewer sees
// booking times in the business's local time.

type DateInput = Date | string | number;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(siteConfig.locale, { timeZone: siteConfig.timeZone, ...options });
}

/** "Mon, Oct 5, 2026" */
export function formatDate(value: DateInput) {
  return formatter({ weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    toDate(value),
  );
}

/** "9:30 AM" */
export function formatTime(value: DateInput) {
  return formatter({ hour: "numeric", minute: "2-digit" }).format(toDate(value));
}

/** "Mon, Oct 5, 2026, 9:30 AM" */
export function formatDateTime(value: DateInput) {
  return formatter({
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(value));
}

/** "9:30 – 10:30 AM" */
export function formatTimeRange(start: DateInput, end: DateInput) {
  return formatter({ hour: "numeric", minute: "2-digit" }).formatRange(toDate(start), toDate(end));
}

/** Short zone label such as "GMT+8" for the business time zone. */
export function timeZoneLabel(at: DateInput = new Date()) {
  const parts = formatter({ timeZoneName: "short" }).formatToParts(toDate(at));
  return parts.find((part) => part.type === "timeZoneName")?.value ?? siteConfig.timeZone;
}

export function formatMoney(amount: number | string | { toString(): string }) {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency: siteConfig.currency,
  }).format(Number(amount.toString()));
}

/** "Juan Dela Cruz" -> "JD" */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatPercent(ratio: number) {
  return new Intl.NumberFormat(siteConfig.locale, { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const relative = new Intl.RelativeTimeFormat(siteConfig.locale, { numeric: "auto" });

/** "3 hours ago", "in 2 days" */
export function formatRelative(value: DateInput, now: Date = new Date()) {
  const seconds = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
