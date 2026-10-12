import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import {
  assignResource,
  cancelBooking,
  getBookingForActor,
  rescheduleBooking,
  setBookingStatus,
} from "@/lib/bookings";
import {
  notifyBookingCancelled,
  notifyBookingCompleted,
  notifyBookingConfirmed,
  notifyBookingRescheduled,
  notifyPaymentRecorded,
  notifyResourceChanged,
} from "@/lib/notifications";
import { confirmReportedPayment } from "@/lib/payments";
import { serializeBooking } from "@/lib/serializers";
import { requireApiUser } from "@/lib/session";
import { updateBookingSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const actorLabels = { CUSTOMER: "the guest", PROVIDER: "the business", EMPLOYEE: "staff", ADMIN: "an admin" } as const;

/** GET /api/bookings/:id, visible to the guest, the business, assigned staff and admins. */
export const GET = handle(async (_request: Request, { params }: Context) => {
  const user = await requireApiUser();
  const booking = await getBookingForActor((await params).id, user);
  return NextResponse.json({ booking: serializeBooking(booking) });
});

/**
 * PATCH /api/bookings/:id with one of:
 *   { action: "cancel" }
 *   { action: "reschedule", startAt }              timed options
 *   { action: "reschedule", checkIn, nights }      overnight stays
 *   { action: "status", status: "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED" }
 *   { action: "assign", resourceId }
 * Role, ownership and the cancellation policy are checked in lib/bookings.
 */
export const PATCH = handle(async (request: Request, { params }: Context) => {
  const user = await requireApiUser();
  const { id } = await params;
  const input = updateBookingSchema.parse(await readJson(request));
  const actorLabel = actorLabels[user.role];

  switch (input.action) {
    case "cancel": {
      const booking = await cancelBooking(id, user);
      await notifyBookingCancelled(booking, actorLabel);
      return NextResponse.json({ booking: serializeBooking(booking) });
    }
    case "reschedule": {
      const { booking, previous } = await rescheduleBooking({ bookingId: id, when: input.when, actor: user });
      await notifyBookingRescheduled(booking, previous);
      return NextResponse.json({ booking: serializeBooking(booking) });
    }
    case "assign": {
      const { booking, previous } = await assignResource({ bookingId: id, resourceId: input.resourceId, actor: user });
      await notifyResourceChanged(booking, previous);
      return NextResponse.json({ booking: serializeBooking(booking) });
    }
    case "status": {
      let booking = await setBookingStatus(id, input.status, user);
      if (input.status === "CONFIRMED") {
        // Confirming the booking confirms the GCash payment the guest reported.
        const paid = await confirmReportedPayment(booking.id);
        if (paid) {
          booking = paid;
          await notifyPaymentRecorded(booking);
        }
        await notifyBookingConfirmed(booking);
      }
      if (input.status === "CANCELLED") await notifyBookingCancelled(booking, actorLabel);
      if (input.status === "COMPLETED") await notifyBookingCompleted(booking);
      return NextResponse.json({ booking: serializeBooking(booking) });
    }
  }
});
