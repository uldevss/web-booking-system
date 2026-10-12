import "server-only";
import type { PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/client";
import { bookingInclude, getBookingForActor, type Actor } from "./bookings";
import { AppError } from "./errors";
import { commissionOn, getPlatformSettings } from "./platform";
import { prisma } from "./prisma";

// Payment tracking. Guests pay the platform's GCash and report the reference;
// confirming the booking confirms that payment (with the platform commission).
// Admins can still correct a payment by hand. Nothing is charged online.

/**
 * Called when the business confirms a booking: the payment the guest reported
 * becomes confirmed (PARTIAL for a deposit, PAID for the full amount) and the
 * commission is fixed. Returns the booking when a payment was newly recorded.
 */
export async function confirmReportedPayment(bookingId: string) {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment || payment.status !== "UNPAID" || !payment.claimedAt || Number(payment.amountDue) <= 0) return null;

  const settings = await getPlatformSettings();
  const percent = Number(settings.commissionPercent);
  const amount = Number(payment.amountDue);
  await prisma.payment.update({
    where: { bookingId },
    data: {
      status: payment.plan === "DEPOSIT" ? "PARTIAL" : "PAID",
      amountPaid: amount.toFixed(2),
      commissionPercent: percent.toFixed(2),
      commissionAmount: commissionOn(amount, percent).toFixed(2),
      paidAt: new Date(),
    },
  });
  return prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
}

export async function recordPayment(input: {
  bookingId: string;
  actor: Actor;
  status: PaymentStatus;
  amountPaid: string;
  method: PaymentMethod;
  reference?: string;
}) {
  if (input.actor.role !== "PROVIDER" && input.actor.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only the provider can record payments.");
  }
  const booking = await getBookingForActor(input.bookingId, input.actor);

  const amount = Number(input.amountPaid);
  if ((input.status === "PAID" || input.status === "PARTIAL") && amount <= 0) {
    throw new AppError("BAD_REQUEST", "Enter the amount the customer paid.");
  }
  if (input.status === "PARTIAL" && amount >= Number(booking.priceAtBooking)) {
    throw new AppError("BAD_REQUEST", "A partial payment must be less than the booking price.");
  }

  const received = input.status === "PAID" || input.status === "PARTIAL";
  // Keep the first payment date; clear it if the booking is marked unpaid again.
  let paidAt = booking.payment?.paidAt ?? null;
  if (received && !paidAt) paidAt = new Date();
  if (input.status === "UNPAID") paidAt = null;

  // The platform keeps its commission on every confirmed amount, at the rate
  // in force when the payment is confirmed.
  const settings = await getPlatformSettings();
  const percent = received ? Number(settings.commissionPercent) : 0;
  const commission = received ? commissionOn(amount, percent) : 0;

  const data = {
    status: input.status,
    amountPaid: input.status === "UNPAID" ? "0" : input.amountPaid,
    commissionPercent: percent.toFixed(2),
    commissionAmount: commission.toFixed(2),
    method: input.method,
    reference: input.reference ?? null,
    paidAt,
  };

  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: { bookingId: booking.id, ...data },
    update: data,
  });

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  const newlyReceived = received && booking.payment?.status !== input.status;
  return { booking: updated, newlyReceived };
}
