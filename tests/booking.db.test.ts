// Integration tests for the booking engine against a real Postgres database
// (TEST_DATABASE_URL, migrated before the tests run). Skipped when the test
// database isn't reachable, e.g. when `npm run db:start` isn't running.

import "dotenv/config";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { after, before, describe, it, type TestContext } from "node:test";
import { addDays, toDayKey, zonedTimeToUtc } from "@/lib/time";

const TZ = "Asia/Manila";
const testUrl = process.env.TEST_DATABASE_URL;
// Point the app's Prisma client at the test database before it is imported.
if (testUrl) process.env.DATABASE_URL = testUrl;
process.env.NEXT_PUBLIC_TIMEZONE = TZ;

type Engine = typeof import("@/lib/bookings");
type Db = typeof import("@/lib/prisma").prisma;
const paid = { plan: "FULL" as const, method: "GCASH" as const, reference: "TEST-REF-0001" };

describe("booking engine (Postgres)", () => {
  let ready = false;
  let prisma: Db;
  let engine: Engine;
  let providerOwnerId: string;
  let providerId: string;
  /** A timed option (escape room style): 60 minutes, up to 6 guests. */
  let serviceId: string;
  /** A nightly option (hotel style). */
  let roomServiceId: string;
  let roomA: string;
  let spaceA: string;
  let customers: { id: string }[];
  const day = addDays(toDayKey(new Date(), TZ), 3);
  const at = (hour: number, minute = 0) => zonedTimeToUtc(day, hour * 60 + minute, TZ);
  const allWeek = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "08:00", endTime: "20:00" }));
  const allDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "00:00", endTime: "23:59" }));

  function needsDatabase(t: TestContext) {
    if (!ready) t.skip("test database unavailable");
    return ready;
  }

  async function addSpace(name: string) {
    const resource = await prisma.resource.create({
      data: { providerId, kind: "SPACE", name, services: { connect: { id: serviceId } }, schedules: { create: allWeek } },
    });
    return resource.id;
  }

  before(async () => {
    if (!testUrl) {
      console.warn("TEST_DATABASE_URL is not set: skipping database tests.");
      return;
    }
    try {
      execSync("npx prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl, CHECKPOINT_DISABLE: "1" },
        stdio: "pipe",
      });
    } catch {
      console.warn("Test database unavailable (is `npm run db:start` running?): skipping database tests.");
      return;
    }

    ({ prisma } = await import("@/lib/prisma"));
    engine = await import("@/lib/bookings");
    await prisma.$executeRawUnsafe(`TRUNCATE "User", "RateLimit" CASCADE`);

    const owner = await prisma.user.create({
      data: { name: "Owner", email: "owner@test.local", passwordHash: "x", role: "PROVIDER" },
    });
    providerOwnerId = owner.id;
    const provider = await prisma.provider.create({
      data: { ownerId: owner.id, businessName: "Test Escape Rooms", category: "ESCAPE_ROOM", isApproved: true },
    });
    providerId = provider.id;
    const service = await prisma.service.create({
      data: { providerId, name: "The Heist", bookingType: "TIMED", pricingUnit: "PER_PERSON", durationMin: 60, price: "500", maxGuests: 6 },
    });
    serviceId = service.id;
    spaceA = await addSpace("Room Alpha");

    const room = await prisma.service.create({
      data: {
        providerId,
        name: "Deluxe Room",
        bookingType: "NIGHTLY",
        pricingUnit: "PER_NIGHT",
        price: "4000",
        maxGuests: 2,
        checkInTime: "14:00",
        checkOutTime: "12:00",
      },
    });
    roomServiceId = room.id;
    roomA = (
      await prisma.resource.create({
        data: { providerId, kind: "ROOM", name: "Room 101", services: { connect: { id: roomServiceId } }, schedules: { create: allDay } },
      })
    ).id;

    customers = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        prisma.user.create({ data: { name: `Customer ${i}`, email: `c${i}@test.local`, passwordHash: "x" } }),
      ),
    );
    ready = true;
  });

  after(async () => {
    await prisma?.$disconnect();
  });

  it("lets exactly one of many simultaneous requests take a slot", async (t) => {
    if (!needsDatabase(t)) return;
    const startAt = at(10);
    const results = await Promise.allSettled(
      customers.map((customer) => engine.createBooking({ customerId: customer.id, serviceId, when: { startAt }, guests: 2, payment: paid })),
    );

    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const result of results) {
      if (result.status === "rejected") assert.match(String(result.reason.code), /SLOT_UNAVAILABLE|BUSY/);
    }
    assert.equal(await prisma.booking.count({ where: { startAt, status: { in: ["PENDING", "CONFIRMED"] } } }), 1);
  });

  it("prices per-person options by guest count, from the database", async (t) => {
    if (!needsDatabase(t)) return;
    const booking = await prisma.booking.findFirstOrThrow({ where: { startAt: at(10) } });
    assert.equal(Number(booking.priceAtBooking), 1000);
    assert.equal(booking.guests, 2);
  });

  it("rejects more guests than the option allows", async (t) => {
    if (!needsDatabase(t)) return;
    await assert.rejects(
      engine.createBooking({ customerId: customers[1].id, serviceId, when: { startAt: at(12) }, guests: 7, payment: paid }),
      { code: "INVALID_STATE" },
    );
  });

  it("no longer offers a booked slot, but keeps adjacent ones", async (t) => {
    if (!needsDatabase(t)) return;
    const availability = await engine.getAvailability(prisma, { serviceId, from: day, to: day });
    const starts = availability!.slots.map((slot) => slot.start.getTime());
    assert.ok(!starts.includes(at(10).getTime()));
    assert.ok(!starts.includes(at(9, 30).getTime()), "09:30 would overlap 10:00-11:00");
    assert.ok(starts.includes(at(9).getTime()));
    assert.ok(starts.includes(at(11).getTime()));
  });

  it("fills a slot once per free space when several can host the option", async (t) => {
    if (!needsDatabase(t)) return;
    const spaceB = await addSpace("Room Bravo");
    const startAt = at(14);
    const results = await Promise.allSettled(
      customers.map((customer) => engine.createBooking({ customerId: customer.id, serviceId, when: { startAt }, guests: 1, payment: paid })),
    );
    const booked = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    assert.equal(booked.length, 2);
    assert.deepEqual(new Set(booked.map((b) => b.resourceId)), new Set([spaceA, spaceB]));
  });

  it("stops a guest from booking two things at the same time", async (t) => {
    if (!needsDatabase(t)) return;
    const startAt = at(16);
    await engine.createBooking({ customerId: customers[0].id, serviceId, when: { startAt }, guests: 1, payment: paid });
    await assert.rejects(engine.createBooking({ customerId: customers[0].id, serviceId, when: { startAt }, guests: 1, payment: paid }), {
      code: "INVALID_STATE",
    });
  });

  it("rejects overlapping bookings at the database level too", async (t) => {
    if (!needsDatabase(t)) return;
    await assert.rejects(
      prisma.booking.create({
        data: {
          customerId: customers[5].id,
          providerId,
          serviceId,
          resourceId: spaceA,
          startAt: at(10, 30),
          endAt: at(11, 30),
          status: "CONFIRMED",
          priceAtBooking: "500",
        },
      }),
      /Booking_no_overlap|23P01|exclusion/i,
    );
  });

  it("reschedules into a free slot and releases the old one", async (t) => {
    if (!needsDatabase(t)) return;
    const booking = await prisma.booking.findFirstOrThrow({ where: { resourceId: spaceA, startAt: at(10) } });
    const actor = { id: booking.customerId, role: "CUSTOMER" as const };
    const { booking: moved } = await engine.rescheduleBooking({ bookingId: booking.id, when: { startAt: at(12) }, actor });
    assert.equal(moved.startAt.getTime(), at(12).getTime());

    const availability = await engine.getAvailability(prisma, { serviceId, from: day, to: day });
    const tenOClock = availability!.slots.find((slot) => slot.start.getTime() === at(10).getTime());
    assert.ok(tenOClock?.resourceIds.includes(spaceA));
  });

  it("books whole stays and blocks overlapping nights for the same room", async (t) => {
    if (!needsDatabase(t)) return;
    const checkIn = addDays(day, 7);
    const stay = await engine.createBooking({
      customerId: customers[6].id,
      serviceId: roomServiceId,
      when: { checkIn, nights: 3 },
      guests: 2,
      payment: { plan: "DEPOSIT", method: "GCASH", reference: "GC-555" },
    });
    assert.equal(stay.payment?.plan, "DEPOSIT");
    assert.equal(Number(stay.payment?.amountDue), 2400, "20% of 12000");
    assert.equal(stay.payment?.status, "PARTIAL", "a deposit is recorded as partially paid at once");
    assert.equal(Number(stay.payment?.amountPaid), 2400);
    assert.equal(Number(stay.payment?.commissionAmount), 120, "5% commission on the deposit");
    assert.equal(stay.resourceId, roomA);
    assert.equal(Number(stay.priceAtBooking), 12000, "3 nights at 4000");
    assert.equal(stay.startAt.getTime(), zonedTimeToUtc(checkIn, 14 * 60, TZ).getTime());
    assert.equal(stay.endAt.getTime(), zonedTimeToUtc(addDays(checkIn, 3), 12 * 60, TZ).getTime());

    // A stay starting on the second night clashes; one starting on check-out day doesn't.
    await assert.rejects(
      engine.createBooking({ customerId: customers[7].id, serviceId: roomServiceId, when: { checkIn: addDays(checkIn, 1), nights: 1 }, guests: 1, payment: paid }),
      { code: "SLOT_UNAVAILABLE" },
    );
    const next = await engine.createBooking({
      customerId: customers[8].id,
      serviceId: roomServiceId,
      when: { checkIn: addDays(checkIn, 3), nights: 1 },
      guests: 1,
      payment: paid,
    });
    assert.equal(next.resourceId, roomA);

    const availability = await engine.getStayAvailability(prisma, { serviceId: roomServiceId, from: checkIn, to: addDays(checkIn, 4), nights: 1 });
    const offered = availability!.stays.map((s) => s.checkIn);
    assert.ok(!offered.includes(checkIn));
    assert.ok(!offered.includes(addDays(checkIn, 2)));
    assert.ok(offered.includes(addDays(checkIn, 4)));
  });

  it("enforces the cancellation cutoff for guests but not businesses", async (t) => {
    if (!needsDatabase(t)) return;
    const soon = new Date(Date.now() + 2 * 3_600_000);
    const booking = await prisma.booking.create({
      data: {
        customerId: customers[11].id,
        providerId,
        serviceId,
        resourceId: spaceA,
        startAt: soon,
        endAt: new Date(soon.getTime() + 3_600_000),
        status: "CONFIRMED",
        priceAtBooking: "500",
      },
    });
    await assert.rejects(engine.cancelBooking(booking.id, { id: customers[11].id, role: "CUSTOMER" }), {
      code: "INVALID_STATE",
    });
    const cancelled = await engine.cancelBooking(booking.id, { id: providerOwnerId, role: "PROVIDER" });
    assert.equal(cancelled.status, "CANCELLED");
  });

  it("hides other people's bookings", async (t) => {
    if (!needsDatabase(t)) return;
    const booking = await prisma.booking.findFirstOrThrow({ where: { customerId: customers[11].id } });
    await assert.rejects(engine.getBookingForActor(booking.id, { id: customers[3].id, role: "CUSTOMER" }), {
      code: "NOT_FOUND",
    });
  });
});
