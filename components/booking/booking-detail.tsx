import { CalendarClock, Clock, LogIn, LogOut, MapPin, NotebookPen, Phone, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BookingActions } from "@/components/booking/booking-actions";
import { PaymentForm } from "@/components/booking/payment-form";
import { ReviewForm } from "@/components/booking/review-form";
import { RatingStars } from "@/components/rating-stars";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIVE_STATUSES,
  allowedStatusChanges,
  changePolicy,
  getBookingForActor,
  type Actor,
  type BookingWithRelations,
} from "@/lib/bookings";
import { categoryLabel, nightsBetween, resourceKinds, resourceName } from "@/lib/catalog";
import { AppError } from "@/lib/errors";
import { formatDateTime, formatDuration, formatMoney, formatTimeRange, timeZoneLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const methodLabels = { CASH: "Cash", GCASH: "GCash", CARD: "Card", BANK: "Bank transfer" } as const;

/** Loads a booking the actor may see, or renders the 404 page. */
export async function loadBooking(id: string, actor: Actor) {
  try {
    return await getBookingForActor(id, actor);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Booking page body shared by guests, businesses, staff and admins. What
 * each viewer sees and can do depends on `actor`.
 */
export async function BookingDetail({ booking, actor }: { booking: BookingWithRelations; actor: Actor }) {
  const policy = changePolicy(booking, actor);
  const allowedStatuses = allowedStatusChanges(booking, actor);
  const managesBusiness = actor.role === "PROVIDER" || actor.role === "ADMIN";
  const nightly = booking.service.bookingType === "NIGHTLY";
  const nights = nightsBetween(booking.startAt, booking.endAt);

  // The business can move the booking to any active resource set up for this option.
  const resources = managesBusiness
    ? (
        await prisma.resource.findMany({
          where: { providerId: booking.providerId, isActive: true, services: { some: { id: booking.serviceId } } },
          select: { id: true, kind: true, name: true, user: { select: { name: true } } },
          orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        })
      ).map((resource) => ({ id: resource.id, name: `${resourceName(resource)} (${resourceKinds[resource.kind].label})` }))
    : undefined;

  // Tell guests why they can't change an upcoming booking (the cutoff); stay quiet for past ones.
  const showPolicyNote = actor.role === "CUSTOMER" && ACTIVE_STATUSES.includes(booking.status) && !policy.allowed;
  const hasActions = allowedStatuses.length > 0 || policy.allowed || showPolicyNote;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{booking.service.name}</CardTitle>
              <CardDescription>Booking {booking.id.slice(-8).toUpperCase()}</CardDescription>
            </div>
            <BookingStatusBadge status={booking.status} />
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              {nightly ? (
                <>
                  <Row icon={<LogIn className="size-4" />} label="Check-in">
                    {formatDateTime(booking.startAt)}
                  </Row>
                  <Row icon={<LogOut className="size-4" />} label="Check-out">
                    {formatDateTime(booking.endAt)}
                    <span className="block text-muted-foreground">
                      {nights} night{nights === 1 ? "" : "s"} · {timeZoneLabel(booking.startAt)}
                    </span>
                  </Row>
                </>
              ) : (
                <>
                  <Row icon={<CalendarClock className="size-4" />} label="When">
                    {formatDateTime(booking.startAt)}
                    <span className="block text-muted-foreground">
                      {formatTimeRange(booking.startAt, booking.endAt)} · {timeZoneLabel(booking.startAt)}
                    </span>
                  </Row>
                  <Row icon={<Clock className="size-4" />} label="Length">
                    {formatDuration(booking.service.durationMin ?? 0)}
                  </Row>
                </>
              )}
              <Row icon={<Users className="size-4" />} label="Guests">
                {booking.guests}
              </Row>
              <Row icon={<MapPin className="size-4" />} label={categoryLabel(booking.provider.category)}>
                <Link href={`/providers/${booking.provider.id}`} className="font-medium hover:underline">
                  {booking.provider.businessName}
                </Link>
                {booking.provider.address ? (
                  <span className="block text-muted-foreground">{booking.provider.address}</span>
                ) : null}
              </Row>
              <Row icon={<UserRound className="size-4" />} label="Assigned to">
                {booking.resource ? (
                  <>
                    {resourceName(booking.resource)}
                    <span className="block text-muted-foreground">{resourceKinds[booking.resource.kind].label}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Not assigned yet</span>
                )}
              </Row>
              {actor.role !== "CUSTOMER" ? (
                <Row icon={<Phone className="size-4" />} label="Guest">
                  {booking.customer.name}
                  <span className="block text-muted-foreground">
                    {booking.customer.email}
                    {booking.customer.phone ? ` · ${booking.customer.phone}` : ""}
                  </span>
                </Row>
              ) : null}
              {booking.notes ? (
                <Row icon={<NotebookPen className="size-4" />} label="Requests">
                  <span className="whitespace-pre-wrap">{booking.notes}</span>
                </Row>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {hasActions ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage booking</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingActions
                booking={{
                  id: booking.id,
                  startAt: booking.startAt.toISOString(),
                  serviceId: booking.serviceId,
                  resourceId: booking.resourceId,
                  bookingType: booking.service.bookingType,
                  nights,
                }}
                allowedStatuses={allowedStatuses}
                canChange={policy.allowed}
                changeBlockedReason={showPolicyNote ? policy.reason : null}
                resources={resources}
              />
            </CardContent>
          </Card>
        ) : null}

        {actor.role === "CUSTOMER" && booking.status === "COMPLETED" ? (
          <Card id="review">
            <CardHeader>
              <CardTitle className="text-base">{booking.review ? "Your review" : "Rate your experience"}</CardTitle>
            </CardHeader>
            <CardContent>
              {booking.review ? (
                <div className="grid gap-2">
                  <RatingStars value={booking.review.rating} />
                  {booking.review.comment ? <p className="text-sm">{booking.review.comment}</p> : null}
                  {booking.review.isHidden ? (
                    <p className="text-xs text-muted-foreground">This review was hidden by a moderator.</p>
                  ) : null}
                </div>
              ) : (
                <ReviewForm bookingId={booking.id} />
              )}
            </CardContent>
          </Card>
        ) : null}

        {actor.role !== "CUSTOMER" && booking.review ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Guest review</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <RatingStars value={booking.review.rating} />
              {booking.review.comment ? <p className="text-sm">{booking.review.comment}</p> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
            <CardDescription>Paid by GCash to the platform account</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="text-right font-medium tabular-nums">
                {Number(booking.priceAtBooking) === 0 ? "Free" : formatMoney(booking.priceAtBooking)}
              </dd>
              {booking.payment?.claimedAt ? (
                <>
                  <dt className="text-muted-foreground">{booking.payment.plan === "DEPOSIT" ? "Deposit due" : "Paid upfront"}</dt>
                  <dd className="text-right tabular-nums">{formatMoney(booking.payment.amountDue)}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-right">
                <PaymentStatusBadge status={booking.payment?.status ?? "UNPAID"} />
              </dd>
              {booking.payment?.claimedAt && booking.status === "PENDING" ? (
                <dd className="col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {actor.role === "CUSTOMER" ? "You paid" : "Guest paid"} {formatMoney(booking.payment.amountPaid)} via {methodLabels[booking.payment.method]}
                  {booking.payment.reference ? `, ref. ${booking.payment.reference}` : ""}, on {formatDateTime(booking.payment.claimedAt)}.{" "}
                  {actor.role === "CUSTOMER" ? "Waiting for the business to confirm the booking." : "Check the reference in GCash before confirming the booking."}
                </dd>
              ) : null}
              {booking.payment && booking.payment.status !== "UNPAID" ? (
                <>
                  <dt className="text-muted-foreground">Amount paid</dt>
                  <dd className="text-right tabular-nums">{formatMoney(booking.payment.amountPaid)}</dd>
                  <dt className="text-muted-foreground">Method</dt>
                  <dd className="text-right">{methodLabels[booking.payment.method]}</dd>
                  {booking.payment.reference ? (
                    <>
                      <dt className="text-muted-foreground">Reference</dt>
                      <dd className="text-right break-all">{booking.payment.reference}</dd>
                    </>
                  ) : null}
                </>
              ) : null}
            </dl>
            {managesBusiness && actor.role === "PROVIDER" ? (
              <p className="border-t pt-4 text-xs text-muted-foreground">
                Payments are recorded automatically when the guest pays by GCash, and appear under Earnings with the platform
                commission taken off. If a reference doesn&apos;t check out in GCash, cancel the booking.
              </p>
            ) : null}
            {actor.role === "ADMIN" ? (
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Record payment (admin correction)</p>
                <PaymentForm
                  bookingId={booking.id}
                  price={booking.priceAtBooking.toString()}
                  payment={
                    booking.payment
                      ? {
                          status: booking.payment.status,
                          plan: booking.payment.plan,
                          amountDue: booking.payment.amountDue.toString(),
                          amountPaid: booking.payment.amountPaid.toString(),
                          method: booking.payment.method,
                          reference: booking.payment.reference,
                        }
                      : null
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
