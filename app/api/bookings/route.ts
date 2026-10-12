import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { bookingInclude, createBooking } from "@/lib/bookings";
import { AppError } from "@/lib/errors";
import { notifyBookingCreated } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { rateLimit, retryMessage } from "@/lib/rate-limit";
import { serializeBooking } from "@/lib/serializers";
import { requireApiUser } from "@/lib/session";
import { createBookingSchema } from "@/lib/validators";

/** GET /api/bookings: the signed-in customer's bookings, newest first. */
export const GET = handle(async () => {
  const user = await requireApiUser(["CUSTOMER"]);
  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    include: bookingInclude,
    orderBy: { startAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ bookings: bookings.map(serializeBooking) });
});

/** POST /api/bookings: book a time or stay; a free room, table, space or guide is assigned automatically. */
export const POST = handle(async (request: Request) => {
  const user = await requireApiUser(["CUSTOMER"]);

  const limit = await rateLimit(`booking:${user.id}`, 10, 10 * 60);
  if (!limit.ok) throw new AppError("RATE_LIMITED", retryMessage(limit.retryAfterSeconds));

  const input = createBookingSchema.parse(await readJson(request));
  const booking = await createBooking({ customerId: user.id, ...input });
  await notifyBookingCreated(booking);

  return NextResponse.json({ booking: serializeBooking(booking) }, { status: 201 });
});
