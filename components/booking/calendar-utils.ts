import { siteConfig } from "@/lib/config";
import { addDays, toDayKey } from "@/lib/time";

// The calendar works with local Date objects; the app exchanges days as
// "YYYY-MM-DD" keys in the platform time zone. These convert between the two.

export const keyToDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const dateToKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** First and last day of the month shown, clamped to what can be booked (today .. booking horizon). */
export function bookableRange(month: Date) {
  const today = toDayKey(new Date(), siteConfig.timeZone);
  const lastDay = addDays(today, siteConfig.maxAdvanceDays);
  const first = dateToKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const last = dateToKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { today, lastDay, from: first < today ? today : first, to: last > lastDay ? lastDay : last };
}
