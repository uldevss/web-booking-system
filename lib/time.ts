// Time-zone helpers built on Intl only, so they behave identically on the
// server (UTC on Vercel) and in the browser. Bookings are stored as UTC
// instants; schedules are wall-clock minutes in the business time zone.

export const MINUTES_PER_DAY = 24 * 60;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Calendar fields of `date` as shown on a wall clock in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds. */
function offsetAt(ms: number, timeZone: string) {
  const p = getZonedParts(new Date(ms), timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - (ms - (((ms % 1000) + 1000) % 1000));
}

/**
 * The UTC instant at which a wall clock in `timeZone` reads `minutes` past
 * midnight on calendar day `day` ("YYYY-MM-DD"). `minutes` may exceed a day.
 */
export function zonedTimeToUtc(day: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = parseDayKey(day);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  // Re-check the offset at the result so DST transitions resolve correctly.
  let utc = wall - offsetAt(wall, timeZone);
  const corrected = wall - offsetAt(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

/** "YYYY-MM-DD" of the calendar day `date` falls on in `timeZone`. */
export function toDayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes past midnight on a wall clock in `timeZone`. */
export function minutesOfDay(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** Start (inclusive) and end (exclusive) instants of a calendar day in `timeZone`. */
export function dayBounds(day: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(day, 0, timeZone),
    end: zonedTimeToUtc(addDays(day, 1), 0, timeZone),
  };
}

/** Day of week (0 = Sunday) of a calendar day key. */
export function dayOfWeek(day: string): number {
  const [y, m, d] = parseDayKey(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(day: string, amount: number): string {
  const [y, m, d] = parseDayKey(day);
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Inclusive list of day keys from `from` to `to`. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export type Period = "day" | "week" | "month";

/**
 * Start days ("YYYY-MM-DD") of every day, week or month touching the range,
 * so reports can show empty periods. Weeks start on Monday, like Postgres
 * date_trunc('week').
 */
export function periodStarts(from: string, to: string, period: Period): string[] {
  if (period === "day") return eachDay(from, to);
  const starts: string[] = [];
  if (period === "week") {
    for (let day = addDays(from, -((dayOfWeek(from) + 6) % 7)); day <= to; day = addDays(day, 7)) starts.push(day);
    return starts;
  }
  let [year, month] = parseDayKey(from);
  for (let key = `${year}-${pad(month)}-01`; key <= to; key = `${year}-${pad(month)}-01`) {
    starts.push(key);
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year++;
  }
  return starts;
}

export function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parseDayKey(value);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** 570 -> "09:30" */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "09:30" -> 570; returns NaN for malformed input. "24:00" is allowed as end of day. */
export function timeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return NaN;
  return hours * 60 + minutes;
}

function parseDayKey(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
