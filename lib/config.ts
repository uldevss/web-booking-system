// Platform settings. NEXT_PUBLIC_* values are inlined into browser code too,
// which needs the time zone and locale to render booking times.

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Booking System",
  /** All schedules and booking times use this IANA time zone. */
  timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Manila",
  locale: process.env.NEXT_PUBLIC_LOCALE || "en-PH",
  currency: process.env.NEXT_PUBLIC_CURRENCY || "PHP",
  /** Spacing between offered start times, in minutes. */
  slotIntervalMin: positiveInt(process.env.NEXT_PUBLIC_SLOT_INTERVAL_MIN, 30),
  /** How soon a slot can be booked (60 = at least an hour from now). */
  minLeadMinutes: positiveInt(process.env.NEXT_PUBLIC_MIN_LEAD_MINUTES, 60),
  /** How many days ahead customers can book. */
  maxAdvanceDays: positiveInt(process.env.NEXT_PUBLIC_MAX_ADVANCE_DAYS, 60),
  /** Share of the price a guest must pay upfront (they may also pay in full). */
  depositPercent: positiveInt(process.env.NEXT_PUBLIC_DEPOSIT_PERCENT, 20),
  /** Customers can cancel or reschedule only this many hours before the start. */
  cancellationCutoffHours: positiveInt(process.env.NEXT_PUBLIC_CANCELLATION_CUTOFF_HOURS, 24),
};
