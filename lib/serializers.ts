import type { BookingWithRelations } from "./bookings";
import { resourceName } from "./catalog";

// Plain JSON shapes for API responses and client components (no Decimal or
// Date objects, and only the fields the UI needs).

export function serializeBooking(b: BookingWithRelations) {
  return {
    id: b.id,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    guests: b.guests,
    priceAtBooking: b.priceAtBooking.toString(),
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    service: {
      id: b.service.id,
      name: b.service.name,
      bookingType: b.service.bookingType,
      durationMin: b.service.durationMin,
    },
    provider: {
      id: b.provider.id,
      businessName: b.provider.businessName,
      category: b.provider.category,
      address: b.provider.address,
    },
    resource: b.resource ? { id: b.resource.id, kind: b.resource.kind, name: resourceName(b.resource) } : null,
    customer: { id: b.customer.id, name: b.customer.name, email: b.customer.email, phone: b.customer.phone },
    payment: b.payment
      ? {
          status: b.payment.status,
          plan: b.payment.plan,
          amountDue: b.payment.amountDue.toString(),
          claimedAt: b.payment.claimedAt?.toISOString() ?? null,
          amountPaid: b.payment.amountPaid.toString(),
          method: b.payment.method,
          reference: b.payment.reference,
          paidAt: b.payment.paidAt?.toISOString() ?? null,
        }
      : null,
    review: b.review
      ? { rating: b.review.rating, comment: b.review.comment, createdAt: b.review.createdAt.toISOString() }
      : null,
  };
}

export type BookingDTO = ReturnType<typeof serializeBooking>;
