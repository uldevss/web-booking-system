import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findScheduleProblem, generateSlots, toWorkingRanges, type ResourceAvailability } from "@/lib/slots";
import { zonedTimeToUtc } from "@/lib/time";

const TZ = "Asia/Manila";
const MONDAY = "2026-10-05";
const at = (minutes: number) => zonedTimeToUtc(MONDAY, minutes, TZ);
/** Start times as UTC "HH:MM" (Manila is UTC+8, so 09:00 local = 01:00 UTC). */
const times = (slots: { start: Date }[]) => slots.map((slot) => slot.start.toISOString().slice(11, 16));

const nineToTwelve: ResourceAvailability = {
  resourceId: "room-1",
  ranges: [{ dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60 }],
  busy: [],
};

const base = {
  days: [MONDAY],
  durationMin: 60,
  intervalMin: 30,
  timeZone: TZ,
  notBefore: new Date("2026-01-01T00:00:00Z"),
};

describe("generateSlots", () => {
  it("offers every interval where the full duration fits", () => {
    const slots = generateSlots({ ...base, resources: [nineToTwelve] });
    assert.deepEqual(times(slots), ["01:00", "01:30", "02:00", "02:30", "03:00"]);
    assert.equal(slots[0].end.getTime() - slots[0].start.getTime(), 60 * 60_000);
  });

  it("only uses ranges for the matching weekday", () => {
    assert.deepEqual(generateSlots({ ...base, days: ["2026-10-06"], resources: [nineToTwelve] }), []);
  });

  it("removes slots overlapping busy intervals but keeps adjacent ones", () => {
    const busy = { ...nineToTwelve, busy: [{ start: at(10 * 60), end: at(11 * 60) }] };
    // 09:00-10:00 ends as the booking starts; 11:00-12:00 starts as it ends.
    assert.deepEqual(times(generateSlots({ ...base, resources: [busy] })), ["01:00", "03:00"]);
  });

  it("skips slots before notBefore and at or after notAfter", () => {
    const slots = generateSlots({ ...base, notBefore: at(9 * 60 + 15), notAfter: at(11 * 60), resources: [nineToTwelve] });
    assert.deepEqual(times(slots), ["01:30", "02:00", "02:30"]);
  });

  it("merges resources into shared slots in the order given", () => {
    const table: ResourceAvailability = {
      resourceId: "table-2",
      ranges: [{ dayOfWeek: 1, startMin: 10 * 60, endMin: 12 * 60 }],
      busy: [],
    };
    const slots = generateSlots({ ...base, resources: [nineToTwelve, table] });
    const byTime = new Map(slots.map((slot) => [times([slot])[0], slot.resourceIds]));
    assert.deepEqual(byTime.get("01:00"), ["room-1"]);
    assert.deepEqual(byTime.get("02:00"), ["room-1", "table-2"]);
  });

  it("supports split opening hours", () => {
    const split: ResourceAvailability = {
      resourceId: "room-1",
      ranges: [
        { dayOfWeek: 1, startMin: 9 * 60, endMin: 10 * 60 },
        { dayOfWeek: 1, startMin: 13 * 60, endMin: 14 * 60 },
      ],
      busy: [],
    };
    assert.deepEqual(times(generateSlots({ ...base, resources: [split] })), ["01:00", "05:00"]);
  });
});

describe("schedules", () => {
  it("converts stored HH:MM rows to minute ranges", () => {
    assert.deepEqual(toWorkingRanges([{ dayOfWeek: 2, startTime: "08:30", endTime: "17:00" }]), [
      { dayOfWeek: 2, startMin: 510, endMin: 1020 },
    ]);
  });

  it("accepts non-overlapping hours", () => {
    assert.equal(
      findScheduleProblem([
        { dayOfWeek: 1, startMin: 540, endMin: 720 },
        { dayOfWeek: 1, startMin: 780, endMin: 1020 },
        { dayOfWeek: 2, startMin: 540, endMin: 1020 },
      ]),
      null,
    );
  });

  it("rejects overlapping, inverted and malformed hours", () => {
    assert.match(
      findScheduleProblem([
        { dayOfWeek: 1, startMin: 540, endMin: 720 },
        { dayOfWeek: 1, startMin: 700, endMin: 800 },
      ]) ?? "",
      /overlap/,
    );
    assert.match(findScheduleProblem([{ dayOfWeek: 1, startMin: 600, endMin: 540 }]) ?? "", /end after/);
    assert.match(findScheduleProblem([{ dayOfWeek: 1, startMin: NaN, endMin: 540 }]) ?? "", /09:00/);
  });
});
