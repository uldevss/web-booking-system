import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  dayBounds,
  dayOfWeek,
  eachDay,
  isDayKey,
  minutesOfDay,
  minutesToTime,
  periodStarts,
  timeToMinutes,
  toDayKey,
  zonedTimeToUtc,
} from "@/lib/time";

describe("zonedTimeToUtc", () => {
  it("converts wall-clock time in a fixed-offset zone", () => {
    assert.equal(zonedTimeToUtc("2026-10-05", 9 * 60, "Asia/Manila").toISOString(), "2026-10-05T01:00:00.000Z");
  });

  it("handles times that fall on the previous UTC day", () => {
    assert.equal(zonedTimeToUtc("2026-10-05", 30, "Asia/Manila").toISOString(), "2026-10-04T16:30:00.000Z");
  });

  it("uses the right offset on each side of a DST change", () => {
    // New York switches from EDT (UTC-4) to EST (UTC-5) on 2026-11-01.
    assert.equal(zonedTimeToUtc("2026-10-31", 9 * 60, "America/New_York").toISOString(), "2026-10-31T13:00:00.000Z");
    assert.equal(zonedTimeToUtc("2026-11-02", 9 * 60, "America/New_York").toISOString(), "2026-11-02T14:00:00.000Z");
  });

  it("round-trips with toDayKey and minutesOfDay", () => {
    const instant = zonedTimeToUtc("2026-03-08", 14 * 60 + 45, "America/New_York");
    assert.equal(toDayKey(instant, "America/New_York"), "2026-03-08");
    assert.equal(minutesOfDay(instant, "America/New_York"), 14 * 60 + 45);
  });
});

describe("day helpers", () => {
  it("computes day of week from a day key", () => {
    assert.equal(dayOfWeek("2026-10-04"), 0); // Sunday
    assert.equal(dayOfWeek("2026-10-05"), 1); // Monday
  });

  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("lists days inclusively", () => {
    assert.deepEqual(eachDay("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("returns 23-hour bounds on a DST start day", () => {
    const { start, end } = dayBounds("2026-03-08", "America/New_York");
    assert.equal((end.getTime() - start.getTime()) / 3_600_000, 23);
  });

  it("validates day keys", () => {
    assert.equal(isDayKey("2026-02-28"), true);
    assert.equal(isDayKey("2026-02-30"), false);
    assert.equal(isDayKey("2026-2-3"), false);
  });
});

describe("periodStarts", () => {
  it("lists days", () => {
    assert.deepEqual(periodStarts("2026-10-01", "2026-10-03", "day"), ["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("lists Monday-start weeks touching the range", () => {
    // 2026-09-30 is a Wednesday, so its week starts Monday 2026-09-28.
    assert.deepEqual(periodStarts("2026-09-30", "2026-10-12", "week"), ["2026-09-28", "2026-10-05", "2026-10-12"]);
  });

  it("lists months across a year boundary", () => {
    assert.deepEqual(periodStarts("2026-11-15", "2027-01-10", "month"), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  });
});

describe("time strings", () => {
  it("converts between minutes and HH:MM", () => {
    assert.equal(minutesToTime(570), "09:30");
    assert.equal(timeToMinutes("09:30"), 570);
    assert.equal(timeToMinutes("24:00"), 1440);
    assert.ok(Number.isNaN(timeToMinutes("24:30")));
    assert.ok(Number.isNaN(timeToMinutes("9:30")));
  });
});
