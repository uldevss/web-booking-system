import { dayOfWeek, timeToMinutes, zonedTimeToUtc } from "./time";

// Pure slot generation for timed bookings: given each resource's weekly
// opening hours (a table, an escape room, a tour guide...) and busy intervals,
// list the start times at which an option of `durationMin` fits. The
// availability API and the booking transaction both use this, so a slot can
// only be booked if the API would have offered it.

export type WorkingRange = {
  dayOfWeek: number;
  /** Minutes past midnight, platform time zone */
  startMin: number;
  endMin: number;
};

export type Interval = { start: Date; end: Date };

export type ResourceAvailability = {
  resourceId: string;
  ranges: WorkingRange[];
  /** Existing PENDING/CONFIRMED bookings */
  busy: Interval[];
};

export type Slot = {
  start: Date;
  end: Date;
  /** Resources free for the whole slot, in the order they were supplied */
  resourceIds: string[];
};

export type SlotOptions = {
  days: string[];
  durationMin: number;
  /** Spacing between offered start times */
  intervalMin: number;
  timeZone: string;
  /** Slots starting before this instant are not offered (now + lead time). */
  notBefore: Date;
  /** Slots starting at or after this instant are not offered (booking horizon). */
  notAfter?: Date;
  resources: ResourceAvailability[];
};

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/** Converts stored schedule rows ("09:00"-"17:00") to minute ranges. */
export function toWorkingRanges(
  rows: { dayOfWeek: number; startTime: string; endTime: string }[],
): WorkingRange[] {
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    startMin: timeToMinutes(row.startTime),
    endMin: timeToMinutes(row.endTime),
  }));
}

export function generateSlots(options: SlotOptions): Slot[] {
  const { days, durationMin, intervalMin, timeZone, notBefore, notAfter, resources } = options;
  const durationMs = durationMin * 60_000;
  const byStart = new Map<number, Slot>();

  for (const day of days) {
    const weekday = dayOfWeek(day);
    for (const resource of resources) {
      for (const range of resource.ranges) {
        if (range.dayOfWeek !== weekday) continue;
        for (let minute = range.startMin; minute + durationMin <= range.endMin; minute += intervalMin) {
          const start = zonedTimeToUtc(day, minute, timeZone);
          if (start < notBefore || (notAfter && start >= notAfter)) continue;
          const slot = { start, end: new Date(start.getTime() + durationMs) };
          if (resource.busy.some((busy) => overlaps(slot, busy))) continue;

          const existing = byStart.get(start.getTime());
          if (!existing) {
            byStart.set(start.getTime(), { ...slot, resourceIds: [resource.resourceId] });
          } else if (!existing.resourceIds.includes(resource.resourceId)) {
            existing.resourceIds.push(resource.resourceId);
          }
        }
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Validates a weekly schedule: start before end, inside one day, no overlaps per day. */
export function findScheduleProblem(ranges: WorkingRange[]): string | null {
  for (const range of ranges) {
    if (Number.isNaN(range.startMin) || Number.isNaN(range.endMin)) return "Use times like 09:00.";
    if (range.startMin >= range.endMin) return "Each shift must end after it starts.";
    if (range.startMin < 0 || range.endMin > 24 * 60) return "Shifts must stay within one day.";
  }
  const sorted = [...ranges].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.dayOfWeek === current.dayOfWeek && current.startMin < previous.endMin) {
      return "Shifts on the same day can't overlap.";
    }
  }
  return null;
}
