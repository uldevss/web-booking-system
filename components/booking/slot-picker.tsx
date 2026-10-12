"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bookableRange, dateToKey, keyToDate } from "@/components/booking/calendar-utils";
import { Calendar } from "@/components/ui/calendar";
import { siteConfig } from "@/lib/config";
import { formatDate, formatTime, timeZoneLabel } from "@/lib/format";
import { toDayKey, zonedTimeToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

export type Slot = { start: string; end: string; available: number };

/**
 * Timed bookings: pick a day on the calendar (days without free slots are
 * disabled), then a start time. Loads one month of availability at a time.
 */
export function SlotPicker({
  serviceId,
  excludeBookingId,
  value,
  onChange,
  refreshKey = 0,
}: {
  serviceId: string;
  /** When rescheduling: the booking's own slot counts as free. */
  excludeBookingId?: string;
  value: string | null;
  onChange: (start: string | null) => void;
  /** Change to reload availability (e.g. after a slot was taken). */
  refreshKey?: number;
}) {
  const [month, setMonth] = useState(() => keyToDate(toDayKey(new Date(), siteConfig.timeZone)));
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    value ? toDayKey(new Date(value), siteConfig.timeZone) : null,
  );
  const [result, setResult] = useState<{ range: string; slots: Slot[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { today, lastDay, from, to } = bookableRange(month);
  const range = `${serviceId}:${from}:${to}:${excludeBookingId ?? ""}:${refreshKey}`;
  const loading = from <= to && result?.range !== range && !error;

  useEffect(() => {
    if (from > to) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, from, to });
    if (excludeBookingId) params.set("exclude", excludeBookingId);
    fetch(`/api/availability?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Couldn't load available times.");
        setError(null);
        setResult({ range, slots: data.slots ?? [] });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Couldn't load available times.");
      });
    return () => controller.abort();
  }, [serviceId, from, to, excludeBookingId, range]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of result?.range === range ? result.slots : []) {
      const day = toDayKey(new Date(slot.start), siteConfig.timeZone);
      map.set(day, [...(map.get(day) ?? []), slot]);
    }
    return map;
  }, [result, range]);

  const daySlots = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="relative self-start rounded-lg border">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={(next) => {
            setError(null);
            setMonth(next);
          }}
          selected={selectedDay ? keyToDate(selectedDay) : undefined}
          onSelect={(date) => {
            setSelectedDay(date ? dateToKey(date) : null);
            onChange(null);
          }}
          startMonth={keyToDate(today)}
          endMonth={keyToDate(lastDay)}
          disabled={(date) => loading || !byDay.has(dateToKey(date))}
          className="mx-auto"
        />
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60" aria-live="polite">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading available days" />
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !selectedDay ? (
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Checking availability…"
              : byDay.size
                ? "Pick a highlighted day to see open times."
                : "No open times this month. Try the next month."}
          </p>
        ) : (
          <div>
            <p className="mb-3 text-sm font-medium">
              {formatDate(zonedTimeToUtc(selectedDay, 12 * 60, siteConfig.timeZone))}
              <span className="ml-2 font-normal text-muted-foreground">Times in {timeZoneLabel()}</span>
            </p>
            {daySlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open times left on this day.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Start time">
                {daySlots.map((slot) => {
                  const selected = value === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(slot.start)}
                      className={cn(
                        "rounded-md border px-2 py-2 text-sm font-medium tabular-nums transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary/60 hover:bg-primary/5",
                      )}
                    >
                      {formatTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
