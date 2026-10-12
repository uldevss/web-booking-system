import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getAvailability, getStayAvailability } from "@/lib/bookings";
import { siteConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { availabilityQuerySchema } from "@/lib/validators";

/**
 * GET /api/availability?serviceId=...&date=YYYY-MM-DD
 *   (or &from=YYYY-MM-DD&to=YYYY-MM-DD for a calendar month)
 * Timed options return open start times. Overnight stays (&nights=N, default 1)
 * return the check-in dates with a free room or unit for the whole stay. Public.
 */
export const GET = handle(async (request: Request) => {
  const query = availabilityQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

  // When rescheduling, the booking's own slot counts as free, but only for
  // someone allowed to change that booking.
  let excludeBookingId: string | undefined;
  if (query.exclude) {
    const user = await getCurrentUser();
    const booking = await prisma.booking.findUnique({
      where: { id: query.exclude },
      select: { customerId: true, provider: { select: { ownerId: true } } },
    });
    if (
      user &&
      booking &&
      (user.role === "ADMIN" || booking.customerId === user.id || booking.provider.ownerId === user.id)
    ) {
      excludeBookingId = query.exclude;
    }
  }

  const service = await prisma.service.findUnique({ where: { id: query.serviceId }, select: { bookingType: true } });
  if (!service) throw new AppError("NOT_FOUND", "This option isn't available for booking.");

  if (service.bookingType === "NIGHTLY") {
    const result = await getStayAvailability(prisma, {
      serviceId: query.serviceId,
      from: query.from,
      to: query.to,
      nights: query.nights,
      excludeBookingId,
    });
    if (!result) throw new AppError("NOT_FOUND", "This option isn't available for booking.");
    return NextResponse.json({
      type: "NIGHTLY",
      timeZone: siteConfig.timeZone,
      nights: query.nights,
      stays: result.stays.map((stay) => ({
        checkIn: stay.checkIn,
        start: stay.start.toISOString(),
        end: stay.end.toISOString(),
        available: stay.resourceIds.length,
      })),
    });
  }

  const result = await getAvailability(prisma, {
    serviceId: query.serviceId,
    from: query.from,
    to: query.to,
    excludeBookingId,
  });
  if (!result) throw new AppError("NOT_FOUND", "This option isn't available for booking.");

  return NextResponse.json({
    type: "TIMED",
    timeZone: siteConfig.timeZone,
    durationMin: result.service.durationMin,
    slots: result.slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      available: slot.resourceIds.length,
    })),
  });
});
