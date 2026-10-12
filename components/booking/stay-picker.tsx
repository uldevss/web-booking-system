"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bookableRange, dateToKey, keyToDate } from "@/components/booking/calendar-utils";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { siteConfig } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { toDayKey } from "@/lib/time";

export type Stay = { checkIn: string; start: string; end: string; available: number };

const NIGHT_CHOICES = Array.from({ length: 14 }, (_, i) => i + 1);

/**
 * Overnight stays: choose how many nights, then a check-in date. Only dates
 * with a room or unit free for the whole stay can be picked.
 */
export function StayPicker({
  serviceId,
  excludeBookingId,
  nights,
  onNightsChange,
  value,
  onChange,
  refreshKey = 0,
}: {
  serviceId: string;
  excludeBookingId?: string;
  nights: number;
  onNightsChange: (nights: number) => void;
  /** Selected stay (check-in day key), or null. */
  value: string | null;
  onChange: (stay: Stay | null) => void;
  refreshKey?: number;
}) {
  const [month, setMonth] = useState(() => keyToDate(value ?? toDayKey(new Date(), siteConfig.timeZone)));
  const [result, setResult] = useState<{ range: string; stays: Stay[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { today, lastDay, from, to } = bookableRange(month);
  const range = `${serviceId}:${from}:${to}:${nights}:${excludeBookingId ?? ""}:${refreshKey}`;
  const loading = from <= to && result?.range !== range && !error;

  useEffect(() => {
    if (from > to) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ serviceId, from, to, nights: String(nights) });
    if (excludeBookingId) params.set("exclude", excludeBookingId);
    fetch(`/api/availability?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Couldn't load availability.");
        setError(null);
        setResult({ range, stays: data.stays ?? [] });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Couldn't load availability.");
      });
    return () => controller.abort();
  }, [serviceId, from, to, nights, excludeBookingId, range]);

  const byDay = useMemo(
    () => new Map((result?.range === range ? result.stays : []).map((stay) => [stay.checkIn, stay])),
    [result, range],
  );
  const selected = value ? byDay.get(value) : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="stay-nights">Nights</Label>
          <Select
            value={String(nights)}
            onValueChange={(next) => {
              onNightsChange(Number(next));
              onChange(null);
            }}
          >
            <SelectTrigger id="stay-nights" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NIGHT_CHOICES.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} night{count === 1 ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative rounded-lg border">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={(next) => {
              setError(null);
              setMonth(next);
            }}
            selected={value ? keyToDate(value) : undefined}
            onSelect={(date) => onChange(date ? (byDay.get(dateToKey(date)) ?? null) : null)}
            startMonth={keyToDate(today)}
            endMonth={keyToDate(lastDay)}
            disabled={(date) => loading || !byDay.has(dateToKey(date))}
            className="mx-auto"
          />
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading available dates" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 text-sm">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : selected ? (
          <dl className="grid gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Check-in</dt>
              <dd className="font-medium">{formatDateTime(selected.start)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Check-out</dt>
              <dd className="font-medium">{formatDateTime(selected.end)}</dd>
            </div>
            <p className="text-muted-foreground">
              {selected.available === 1 ? "Last one available for these dates." : `${selected.available} available for these dates.`}
            </p>
          </dl>
        ) : (
          <p className="text-muted-foreground">
            {loading
              ? "Checking availability…"
              : byDay.size
                ? `Pick a check-in date. Highlighted days have availability for ${nights} night${nights === 1 ? "" : "s"}.`
                : "No availability this month for that many nights. Try fewer nights or the next month."}
          </p>
        )}
      </div>
    </div>
  );
}
