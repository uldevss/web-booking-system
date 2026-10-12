import { CalendarPlus, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { BookingStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import { formatDateTime, formatRelative } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My account" };

export default async function CustomerHome() {
  const user = await requireUser(["CUSTOMER"]);
  const now = new Date();
  const [upcoming, toReview, notifications] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id, status: { in: ACTIVE_STATUSES }, endAt: { gt: now } },
      include: { service: { select: { name: true } }, provider: { select: { businessName: true, address: true } } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.booking.findMany({
      where: { customerId: user.id, status: "COMPLETED", review: null },
      include: { service: { select: { name: true } }, provider: { select: { businessName: true } } },
      orderBy: { startAt: "desc" },
      take: 3,
    }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your upcoming bookings and latest updates."
        actions={
          <Button asChild>
            <Link href="/services">
              <CalendarPlus aria-hidden />
              Book a service
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section className="grid content-start gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Upcoming</h2>
          {upcoming.length ? (
            upcoming.map((booking) => (
              <Link
                key={booking.id}
                href={`/dashboard/bookings/${booking.id}`}
                className="rounded-lg border p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{booking.service.name}</p>
                    <p className="text-sm text-muted-foreground">{booking.provider.businessName}</p>
                  </div>
                  <BookingStatusBadge status={booking.status} />
                </div>
                <p className="mt-3 text-sm font-medium">{formatDateTime(booking.startAt)}</p>
                {booking.provider.address ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin aria-hidden className="size-3.5" />
                    {booking.provider.address}
                  </p>
                ) : null}
              </Link>
            ))
          ) : (
            <EmptyState
              title="No upcoming bookings"
              description="Find a service and pick a time that works for you."
              action={
                <Button asChild variant="outline">
                  <Link href="/services">Browse services</Link>
                </Button>
              }
            />
          )}
        </section>

        <div className="grid content-start gap-6">
          {toReview.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Waiting for your review</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {toReview.map((booking) => (
                  <Link key={booking.id} href={`/dashboard/bookings/${booking.id}#review`} className="text-sm hover:underline">
                    <span className="font-medium">{booking.service.name}</span>
                    <span className="text-muted-foreground"> · {booking.provider.businessName}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest updates</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length ? (
                <ul className="grid gap-3">
                  {notifications.map((note) => (
                    <li key={note.id} className="text-sm">
                      <p className="font-medium">{note.title}</p>
                      <p className="text-muted-foreground">{note.message}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(note.createdAt, now)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing new.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
