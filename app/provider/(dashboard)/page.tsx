import { CheckCircle2, Circle, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { BookingStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import { nightsBetween, resourceName } from "@/lib/catalog";
import { siteConfig } from "@/lib/config";
import { formatDate, formatDateTime, formatMoney, formatRelative, formatTime, formatTimeRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { providerRating } from "@/lib/reviews";
import { requireProvider } from "@/lib/session";
import { dayBounds, toDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Business overview" };

export default async function ProviderOverview() {
  const { provider } = await requireProvider();
  const today = toDayKey(new Date(), siteConfig.timeZone);
  const { start, end } = dayBounds(today, siteConfig.timeZone);
  const monthStart = dayBounds(`${today.slice(0, 8)}01`, siteConfig.timeZone).start;

  const [todays, pending, requests, revenue, rating, setup] = await Promise.all([
    prisma.booking.findMany({
      where: { providerId: provider.id, startAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: {
        service: { select: { name: true, bookingType: true } },
        customer: { select: { name: true } },
        resource: { select: { name: true, user: { select: { name: true } } } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.booking.count({ where: { providerId: provider.id, status: "PENDING", startAt: { gt: new Date() } } }),
    // The latest requests, newest first, so a booking made a minute ago is at the top.
    prisma.booking.findMany({
      where: { providerId: provider.id, status: "PENDING", startAt: { gt: new Date() } },
      include: {
        service: { select: { name: true, bookingType: true } },
        customer: { select: { name: true } },
        resource: { select: { name: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.payment.aggregate({
      where: { booking: { providerId: provider.id }, status: { in: ["PAID", "PARTIAL"] }, paidAt: { gte: monthStart } },
      _sum: { amountPaid: true },
    }),
    providerRating(provider.id),
    Promise.all([
      prisma.service.count({ where: { providerId: provider.id, isActive: true } }),
      prisma.resource.count({ where: { providerId: provider.id, isActive: true } }),
      // Timed options need opening hours; overnight stays don't.
      prisma.service.count({
        where: {
          providerId: provider.id,
          isActive: true,
          bookingType: "TIMED",
          resources: { none: { isActive: true, schedules: { some: {} } } },
        },
      }),
      prisma.service.count({ where: { providerId: provider.id, isActive: true, resources: { some: { isActive: true } } } }),
    ]),
  ]);

  const [services, resources, timedWithoutHours, linkedServices] = setup;
  const steps = [
    { done: resources > 0, label: "Add your rooms, tables, spaces or staff", href: "/provider/resources" },
    { done: services > 0, label: "Add booking options and prices", href: "/provider/services/new" },
    { done: linkedServices > 0, label: "Link resources to your booking options", href: "/provider/services" },
    { done: services > 0 && timedWithoutHours === 0, label: "Set opening hours for timed bookings", href: "/provider/resources" },
  ];
  const setupComplete = steps.every((step) => step.done);
  const active = todays.filter((booking) => ACTIVE_STATUSES.includes(booking.status));

  return (
    <>
      <PageHeader title="Overview" description={provider.businessName} />

      {!provider.isApproved ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Waiting for approval</p>
            <p className="text-muted-foreground">
              An admin is reviewing your business. Customers can&apos;t see your services yet, but you can finish setting up below.
            </p>
          </div>
        </div>
      ) : null}

      {!setupComplete ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Finish setting up</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  {step.done ? (
                    <CheckCircle2 aria-hidden className="size-5 text-emerald-600" />
                  ) : (
                    <Circle aria-hidden className="size-5 text-muted-foreground" />
                  )}
                  {step.done ? (
                    <span className="text-muted-foreground line-through">{step.label}</span>
                  ) : (
                    <Link href={step.href} className="font-medium text-primary hover:underline">
                      {step.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Starting or checking in today" value={active.length} />
        <StatCard
          label="Waiting for confirmation"
          value={pending}
          hint={pending ? <Link href="/provider/bookings?status=PENDING" className="text-primary hover:underline">Review now</Link> : undefined}
        />
        <StatCard label="Collected this month" value={formatMoney(revenue._sum.amountPaid ?? 0)} />
        <StatCard
          label="Average rating"
          value={rating.count ? rating.average.toFixed(1) : "–"}
          hint={`${rating.count} review${rating.count === 1 ? "" : "s"}`}
        />
      </div>

      {requests.length ? (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">New requests</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/provider/bookings?status=PENDING">Review all ({pending})</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {requests.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/provider/bookings/${booking.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {booking.customer.name} · {booking.service.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.service.bookingType === "NIGHTLY"
                          ? `Check-in ${formatDate(booking.startAt)} · ${nightsBetween(booking.startAt, booking.endAt)} night${nightsBetween(booking.startAt, booking.endAt) === 1 ? "" : "s"}`
                          : formatDateTime(booking.startAt)}
                        {` · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}`}
                        {booking.resource ? ` · ${resourceName(booking.resource)}` : ""}
                        {` · requested ${formatRelative(booking.createdAt)}`}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Today</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/provider/bookings">All bookings</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todays.length ? (
            <ul className="divide-y">
              {todays.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/provider/bookings/${booking.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">
                        {booking.service.bookingType === "NIGHTLY"
                          ? `Check-in ${formatTime(booking.startAt)} · ${nightsBetween(booking.startAt, booking.endAt)} night${nightsBetween(booking.startAt, booking.endAt) === 1 ? "" : "s"}`
                          : formatTimeRange(booking.startAt, booking.endAt)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.service.name} · {booking.customer.name}
                        {booking.resource ? ` · ${resourceName(booking.resource)}` : ""}
                      </p>
                    </div>
                    <BookingStatusBadge status={booking.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing starts or checks in today" />
          )}
        </CardContent>
      </Card>
    </>
  );
}
