import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { notifyPaymentRecorded } from "@/lib/notifications";
import { recordPayment } from "@/lib/payments";
import { serializeBooking } from "@/lib/serializers";
import { requireApiUser } from "@/lib/session";
import { paymentSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/bookings/:id/payment: the provider records how much was paid and how. */
export const PUT = handle(async (request: Request, { params }: Context) => {
  const user = await requireApiUser(["PROVIDER", "ADMIN"]);
  const input = paymentSchema.parse(await readJson(request));
  const { booking, newlyReceived } = await recordPayment({ bookingId: (await params).id, actor: user, ...input });
  if (newlyReceived) await notifyPaymentRecorded(booking);
  return NextResponse.json({ booking: serializeBooking(booking) });
});
