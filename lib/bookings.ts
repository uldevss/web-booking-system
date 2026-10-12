import "server-only";
import { Prisma, type BookingStatus, type Role } from "@/lib/generated/prisma/client";
import { amountDueFor, bookingTotal, DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT, MAX_NIGHTS, nightsBetween } from "./catalog";
import { siteConfig } from "./config";
import { commissionOn, getPlatformSettings } from "./platform";
import { AppError } from "./errors";
import { prisma } from "./prisma";
import { generateSlots, overlaps, toWorkingRanges, type Interval } from "./slots";
import { addDays, dayBounds, eachDay, timeToMinutes, toDayKey, zonedTimeToUtc } from "./time";

/** Statuses that occupy a resource. */
export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

export type Actor = { id: string; role: Role };
type Db = Prisma.TransactionClient;

const TZ = siteConfig.timeZone;

/** Relations needed to show a booking and to notify everyone involved. */
export const bookingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  provider: { select: { id: true, businessName: true, address: true, ownerId: true, category: true } },
  service: {
    select: { id: true, name: true, durationMin: true, bookingType: true, pricingUnit: true, maxGuests: true },
  },
  resource: { select: { id: true, kind: true, name: true, userId: true, user: { select: { name: true } } } },
  payment: true,
  review: true,
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/** Earliest and latest start (or check-in) that may be booked right now. */
export function bookingWindow(now = new Date()) {
  return {
    notBefore: new Date(now.getTime() + siteConfig.minLeadMinutes * 60_000),
    notAfter: zonedTimeToUtc(addDays(toDayKey(now, TZ), siteConfig.maxAdvanceDays + 1), 0, TZ),
  };
}

// ── Availability ────────────────────────────────────────────────────────────

const bookableServiceSelect = {
  id: true,
  providerId: true,
  bookingType: true,
  pricingUnit: true,
  price: true,
  durationMin: true,
  maxGuests: true,
  checkInTime: true,
  checkOutTime: true,
  resources: {
    // Staff resources also need an active login; rooms, tables and spaces don't have one.
    where: { isActive: true, OR: [{ userId: null }, { user: { isActive: true } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, schedules: { select: { dayOfWeek: true, startTime: true, endTime: true } } },
  },
} satisfies Prisma.ServiceSelect;

/** An active option of an approved business, with the resources that can fulfil it. */
function loadBookableService(db: Db, serviceId: string) {
  return db.service.findFirst({
    where: { id: serviceId, isActive: true, provider: { isApproved: true } },
    select: bookableServiceSelect,
  });
}

type BookableService = NonNullable<Awaited<ReturnType<typeof loadBookableService>>>;

/** Active bookings per resource that overlap [from, to). */
async function busyByResource(db: Db, resourceIds: string[], from: Date, to: Date, excludeBookingId?: string) {
  const bookings = await db.booking.findMany({
    where: {
      resourceId: { in: resourceIds },
      status: { in: ACTIVE_STATUSES },
      startAt: { lt: to },
      endAt: { gt: from },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { resourceId: true, startAt: true, endAt: true },
  });
  const busy = new Map<string, Interval[]>(resourceIds.map((id) => [id, []]));
  for (const booking of bookings) {
    if (booking.resourceId) busy.get(booking.resourceId)?.push({ start: booking.startAt, end: booking.endAt });
  }
  return busy;
}

/**
 * Timed options: open start times between two calendar days (inclusive). Each
 * resource's opening hours cut into slots, minus PENDING/CONFIRMED bookings and
 * anything already past. Null if the option isn't bookable or isn't timed.
 */
export async function getAvailability(
  db: Db,
  input: { serviceId: string; from: string; to: string; excludeBookingId?: string; now?: Date },
) {
  const service = await loadBookableService(db, input.serviceId);
  if (!service || service.bookingType !== "TIMED" || !service.durationMin) return null;

  const resourceIds = service.resources.map((resource) => resource.id);
  const busy = await busyByResource(
    db,
    resourceIds,
    dayBounds(input.from, TZ).start,
    dayBounds(input.to, TZ).end,
    input.excludeBookingId,
  );

  const slots = generateSlots({
    days: eachDay(input.from, input.to),
    durationMin: service.durationMin,
    intervalMin: siteConfig.slotIntervalMin,
    timeZone: TZ,
    ...bookingWindow(input.now),
    resources: service.resources.map((resource) => ({
      resourceId: resource.id,
      ranges: toWorkingRanges(resource.schedules),
      busy: busy.get(resource.id) ?? [],
    })),
  });

  return { service, slots };
}

/** Check-in and check-out instants of a stay. */
export function stayBounds(
  service: { checkInTime: string | null; checkOutTime: string | null },
  checkIn: string,
  nights: number,
) {
  return {
    start: zonedTimeToUtc(checkIn, timeToMinutes(service.checkInTime ?? DEFAULT_CHECK_IN), TZ),
    end: zonedTimeToUtc(addDays(checkIn, nights), timeToMinutes(service.checkOutTime ?? DEFAULT_CHECK_OUT), TZ),
  };
}

/**
 * Nightly options: for each possible check-in day in the range, the rooms or
 * units free for the whole stay of `nights` nights.
 */
export async function getStayAvailability(
  db: Db,
  input: { serviceId: string; from: string; to: string; nights: number; excludeBookingId?: string; now?: Date },
) {
  const service = await loadBookableService(db, input.serviceId);
  if (!service || service.bookingType !== "NIGHTLY") return null;

  const resourceIds = service.resources.map((resource) => resource.id);
  const busy = await busyByResource(
    db,
    resourceIds,
    stayBounds(service, input.from, input.nights).start,
    stayBounds(service, input.to, input.nights).end,
    input.excludeBookingId,
  );
  const { notBefore, notAfter } = bookingWindow(input.now);

  const stays: { checkIn: string; start: Date; end: Date; resourceIds: string[] }[] = [];
  for (const checkIn of eachDay(input.from, input.to)) {
    const stay = stayBounds(service, checkIn, input.nights);
    if (stay.start < notBefore || stay.start >= notAfter) continue;
    const free = resourceIds.filter((id) => !(busy.get(id) ?? []).some((interval) => overlaps(stay, interval)));
    if (free.length) stays.push({ checkIn, ...stay, resourceIds: free });
  }
  return { service, stays };
}

// ── Double-booking protection ───────────────────────────────────────────────
//
// 1. Availability checks and writes run in one SERIALIZABLE transaction, so
//    two concurrent requests can't both see the same resource as free.
//    Postgres aborts one of them (P2034); it is retried, sees the other
//    booking, and either picks another free resource or reports it as taken.
// 2. The Booking_no_overlap exclusion constraint makes overlapping active
//    bookings of one resource impossible at the database level.

const MAX_ATTEMPTS = 5;

/**
 * Serialization failure / deadlock (P2034, SQLSTATE 40001 / 40P01) or the
 * Booking_no_overlap exclusion constraint (23P01): safe to retry, because the
 * retry re-reads availability.
 */
function isRetryable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!(error instanceof Error)) return false;
  let meta = "";
  try {
    meta = JSON.stringify((error as { meta?: unknown }).meta ?? null);
  } catch {
    // Unserializable metadata: rely on the message.
  }
  return /Booking_no_overlap|23P01|40001|40P01|could not serialize|deadlock detected/i.test(`${error.message} ${meta}`);
}

async function serializable<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (!isRetryable(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) {
        throw new AppError("BUSY", "Lots of people are booking right now. Please try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 60));
    }
  }
}

/** When a booking happens: a start time for timed options, check-in + nights for stays. */
export type BookingWhen = { startAt: Date } | { checkIn: string; nights: number };

/**
 * Re-checks that the requested time or stay is still offered and returns the
 * resources free for it, least busy first. Also stops a customer from being
 * in two timed bookings at once (several rooms for one stay is fine).
 */
async function resolveAvailability(
  tx: Db,
  input: { serviceId: string; when: BookingWhen; customerId?: string; excludeBookingId?: string },
) {
  const service = await loadBookableService(tx, input.serviceId);
  if (!service) throw new AppError("NOT_FOUND", "This option isn't available for booking.");

  if (service.bookingType === "NIGHTLY") {
    if (!("checkIn" in input.when)) throw new AppError("BAD_REQUEST", "Choose a check-in date and number of nights.");
    const { checkIn, nights } = input.when;
    if (nights < 1 || nights > MAX_NIGHTS) {
      throw new AppError("BAD_REQUEST", `Stays can be 1 to ${MAX_NIGHTS} nights.`);
    }
    const availability = await getStayAvailability(tx, {
      serviceId: service.id,
      from: checkIn,
      to: checkIn,
      nights,
      excludeBookingId: input.excludeBookingId,
    });
    const stay = availability?.stays.find((s) => s.checkIn === checkIn);
    if (!stay) throw new AppError("SLOT_UNAVAILABLE", "Sorry, those dates are no longer available. Please pick others.");
    return { service, start: stay.start, end: stay.end, resourceIds: stay.resourceIds, nights };
  }

  if (!("startAt" in input.when)) throw new AppError("BAD_REQUEST", "Choose a start time.");
  const startAt = input.when.startAt;
  const day = toDayKey(startAt, TZ);
  const availability = await getAvailability(tx, {
    serviceId: service.id,
    from: day,
    to: day,
    excludeBookingId: input.excludeBookingId,
  });
  const slot = availability?.slots.find((s) => s.start.getTime() === startAt.getTime());
  if (!slot) throw new AppError("SLOT_UNAVAILABLE", "Sorry, that time was just taken. Please pick another.");

  if (input.customerId) {
    const ownClash = await tx.booking.findFirst({
      where: {
        customerId: input.customerId,
        status: { in: ACTIVE_STATUSES },
        service: { bookingType: "TIMED" },
        startAt: { lt: slot.end },
        endAt: { gt: slot.start },
        ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      },
      select: { id: true },
    });
    if (ownClash) throw new AppError("INVALID_STATE", "You already have another booking at that time.");
  }

  // Spread the work: least-booked resource that day first (ties keep setup order).
  const { start, end } = dayBounds(day, TZ);
  const load = await tx.booking.groupBy({
    by: ["resourceId"],
    where: { resourceId: { in: slot.resourceIds }, status: { in: ACTIVE_STATUSES }, startAt: { gte: start, lt: end } },
    _count: { _all: true },
  });
  const count = (id: string) => load.find((row) => row.resourceId === id)?._count._all ?? 0;
  const resourceIds = [...slot.resourceIds].sort((a, b) => count(a) - count(b));
  return { service, start: slot.start, end: slot.end, resourceIds, nights: 1 };
}

function assertGuests(service: Pick<BookableService, "maxGuests">, guests: number) {
  if (guests < 1 || guests > service.maxGuests) {
    throw new AppError(
      "INVALID_STATE",
      service.maxGuests === 1 ? "This option is for 1 guest." : `This option fits up to ${service.maxGuests} guests.`,
    );
  }
}

/** Books a time or stay and assigns a free resource (room, table, guide...) automatically. */
export async function createBooking(input: {
  customerId: string;
  serviceId: string;
  when: BookingWhen;
  guests: number;
  notes?: string;
  /** Deposit or full payment the guest reports having sent (required unless the option is free). */
  payment?: { plan: "DEPOSIT" | "FULL"; method: "GCASH" | "BANK" | "CARD"; reference: string };
}): Promise<BookingWithRelations> {
  const commissionPercent = input.payment ? Number((await getPlatformSettings()).commissionPercent) : 0;
  return serializable(async (tx) => {
    const { service, start, end, resourceIds, nights } = await resolveAvailability(tx, input);
    assertGuests(service, input.guests);
    const total = bookingTotal(service, input.guests, nights);
    if (total > 0 && !input.payment) {
      throw new AppError("BAD_REQUEST", `Pay at least a ${siteConfig.depositPercent}% deposit to book, or the full amount.`);
    }
    const payment = input.payment && total > 0 ? input.payment : null;
    return tx.booking.create({
      data: {
        customerId: input.customerId,
        providerId: service.providerId,
        serviceId: service.id,
        resourceId: resourceIds[0],
        startAt: start,
        endAt: end,
        guests: input.guests,
        // Prices always come from the database, never from the browser.
        priceAtBooking: total.toFixed(2),
        notes: input.notes,
        // The GCash payment the guest made is recorded straight away: a deposit
        // shows as partially paid, the full amount as fully paid, with the
        // platform commission fixed now. The business verifies it in GCash
        // before confirming the booking.
        payment: payment
          ? (() => {
              const due = amountDueFor(total, payment.plan, siteConfig.depositPercent);
              return {
                create: {
                  plan: payment.plan,
                  amountDue: due.toFixed(2),
                  claimedAt: new Date(),
                  method: payment.method,
                  reference: payment.reference,
                  amountPaid: due.toFixed(2),
                  status: payment.plan === "DEPOSIT" ? ("PARTIAL" as const) : ("PAID" as const),
                  commissionPercent: commissionPercent.toFixed(2),
                  commissionAmount: commissionOn(due, commissionPercent).toFixed(2),
                  paidAt: new Date(),
                },
              };
            })()
          : undefined,
      },
      include: bookingInclude,
    });
  });
}

// ── Access and policy ───────────────────────────────────────────────────────

/** Loads a booking if the actor is involved in it (or is an admin). */
export async function getBookingForActor(bookingId: string, actor: Actor) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking || !canView(booking, actor)) throw new AppError("NOT_FOUND", "Booking not found.");
  return booking;
}

function canView(booking: BookingWithRelations, actor: Actor) {
  switch (actor.role) {
    case "ADMIN":
      return true;
    case "CUSTOMER":
      return booking.customerId === actor.id;
    case "PROVIDER":
      return booking.provider.ownerId === actor.id;
    case "EMPLOYEE":
      return booking.resource?.userId === actor.id;
  }
}

/** Hours until a booking starts (or checks in). */
export function hoursUntil(startAt: Date, now = new Date()) {
  return (startAt.getTime() - now.getTime()) / 3_600_000;
}

/** Can this actor still cancel or reschedule? Customers must respect the cutoff. */
export function changePolicy(booking: { status: BookingStatus; startAt: Date }, actor: Actor, now = new Date()) {
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    return { allowed: false, reason: "Only pending or confirmed bookings can be changed." };
  }
  if (actor.role === "EMPLOYEE") {
    return { allowed: false, reason: "Ask the business owner to change this booking." };
  }
  if (actor.role === "CUSTOMER" && hoursUntil(booking.startAt, now) <= siteConfig.cancellationCutoffHours) {
    return {
      allowed: false,
      reason: `Bookings can only be changed more than ${siteConfig.cancellationCutoffHours} hours before the start. Please contact the business.`,
    };
  }
  return { allowed: true, reason: null };
}

function assertCanChange(booking: BookingWithRelations, actor: Actor) {
  const policy = changePolicy(booking, actor);
  if (!policy.allowed) throw new AppError("INVALID_STATE", policy.reason ?? "This booking can't be changed.");
}

// ── Changes ─────────────────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, actor: Actor) {
  const booking = await getBookingForActor(bookingId, actor);
  assertCanChange(booking, actor);
  return transition(booking, "CANCELLED");
}

/**
 * Moves a booking to a new time or new dates, using the same availability
 * check as new bookings. A stay of a different length is repriced at the
 * nightly rate the customer originally agreed to.
 */
export async function rescheduleBooking(input: { bookingId: string; when: BookingWhen; actor: Actor }) {
  const booking = await getBookingForActor(input.bookingId, input.actor);
  assertCanChange(booking, input.actor);

  const updated = await serializable(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: booking.id }, select: { status: true } });
    if (!current || !ACTIVE_STATUSES.includes(current.status)) {
      throw new AppError("INVALID_STATE", "This booking can no longer be rescheduled.");
    }
    const { start, end, resourceIds, nights } = await resolveAvailability(tx, {
      serviceId: booking.serviceId,
      when: input.when,
      customerId: booking.customerId,
      excludeBookingId: booking.id,
    });
    // Keep the same room, table or guide when they are free at the new time.
    const resourceId =
      booking.resourceId && resourceIds.includes(booking.resourceId) ? booking.resourceId : resourceIds[0];

    let priceAtBooking = booking.priceAtBooking.toString();
    if (booking.service.pricingUnit === "PER_NIGHT") {
      const nightly = Number(priceAtBooking) / nightsBetween(booking.startAt, booking.endAt);
      priceAtBooking = (Math.round(nightly * nights * 100) / 100).toFixed(2);
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: { resourceId, startAt: start, endAt: end, priceAtBooking, reminderSentAt: null },
      include: bookingInclude,
    });
  });

  return { booking: updated, previous: booking };
}

/** The business owner (or an admin) assigns a specific room, table, space or staff member. */
export async function assignResource(input: { bookingId: string; resourceId: string; actor: Actor }) {
  if (input.actor.role !== "PROVIDER" && input.actor.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only the business can reassign bookings.");
  }
  const booking = await getBookingForActor(input.bookingId, input.actor);
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    throw new AppError("INVALID_STATE", "Only pending or confirmed bookings can be reassigned.");
  }

  const updated = await serializable(async (tx) => {
    const resource = await tx.resource.findFirst({
      where: {
        id: input.resourceId,
        providerId: booking.providerId,
        isActive: true,
        services: { some: { id: booking.serviceId } },
      },
      select: { id: true },
    });
    if (!resource) throw new AppError("INVALID_STATE", "That resource isn't set up for this option.");
    const clash = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        resourceId: resource.id,
        status: { in: ACTIVE_STATUSES },
        startAt: { lt: booking.endAt },
        endAt: { gt: booking.startAt },
      },
      select: { id: true },
    });
    if (clash) throw new AppError("SLOT_UNAVAILABLE", "That resource is already booked at this time.");
    return tx.booking.update({
      where: { id: booking.id },
      data: { resourceId: resource.id },
      include: bookingInclude,
    });
  });

  return { booking: updated, previous: booking };
}

/** Status changes after booking. Cancelled bookings can't be reopened (the slot may be gone). */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: ["NO_SHOW"],
  NO_SHOW: ["COMPLETED"],
  CANCELLED: [],
};

/** Status changes this actor may make on this booking right now. */
export function allowedStatusChanges(
  booking: { status: BookingStatus; startAt: Date },
  actor: Actor,
  now = new Date(),
): BookingStatus[] {
  const started = booking.startAt <= now;
  return TRANSITIONS[booking.status].filter((status) => {
    if (status === "COMPLETED" || status === "NO_SHOW") return started && actor.role !== "CUSTOMER";
    if (status === "CONFIRMED" || status === "CANCELLED") return actor.role === "PROVIDER" || actor.role === "ADMIN";
    return false;
  });
}

export async function setBookingStatus(bookingId: string, status: BookingStatus, actor: Actor) {
  const booking = await getBookingForActor(bookingId, actor);
  if (!allowedStatusChanges(booking, actor).includes(status)) {
    throw new AppError(
      "INVALID_STATE",
      (status === "COMPLETED" || status === "NO_SHOW") && booking.startAt > new Date()
        ? "A booking can only be marked completed or no-show once it has started."
        : "You can't make that change to this booking.",
    );
  }
  return transition(booking, status);
}

/** Conditional update, so two people changing the same booking can't both win. */
async function transition(booking: BookingWithRelations, status: BookingStatus) {
  const { count } = await prisma.booking.updateMany({
    where: { id: booking.id, status: booking.status },
    data: { status, cancelledAt: status === "CANCELLED" ? new Date() : null },
  });
  if (count === 0) {
    throw new AppError("INVALID_STATE", "Someone else just changed this booking. Refresh and try again.");
  }
  return prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
}
