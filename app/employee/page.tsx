import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { BookingStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import { siteConfig } from "@/lib/config";
import { formatDate, formatTimeRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { addDays, dayBounds, toDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "My bookings" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Row = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: Parameters<typeof BookingStatusBadge>[0]["status"];
  notes: string | null;
  guests: number;
  service: { name: string };
  customer: { name: string };
};

function AppointmentList({ bookings, showDate }: { bookings: Row[]; showDate?: boolean }) {
  return (
    <ul className="divide-y">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link href={`/employee/bookings/${booking.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/40">
            <div className="min-w-0">
              <p className="text-sm font-medium tabular-nums">
                {showDate ? `${formatDate(booking.startAt)} · ` : ""}
                {formatTimeRange(booking.startAt, booking.endAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.service.name} · {booking.customer.name} · {booking.guests} guest{booking.guests === 1 ? "" : "s"}
              </p>
              {booking.notes ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">“{booking.notes}”</p> : null}
            </div>
            <BookingStatusBadge status={booking.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function EmployeeHome() {
  const { user, resource } = await requireStaff();
  const now = new Date();
  const today = toDayKey(now, siteConfig.timeZone);
  const { start: todayStart, end: todayEnd } = dayBounds(today, siteConfig.timeZone);
  const horizon = dayBounds(addDays(today, 14), siteConfig.timeZone).end;
  const select = {
    id: true,
    startAt: true,
    endAt: true,
    status: true,
    notes: true,
    guests: true,
    service: { select: { name: true } },
    customer: { select: { name: true } },
  } as const;

  const [todays, upcoming, needsUpdate, schedules] = await Promise.all([
    prisma.booking.findMany({
      where: { resourceId: resource.id, startAt: { gte: todayStart, lt: todayEnd }, status: { not: "CANCELLED" } },
      select,
      orderBy: { startAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { resourceId: resource.id, startAt: { gte: todayEnd, lt: horizon }, status: { in: ACTIVE_STATUSES } },
      select,
      orderBy: { startAt: "asc" },
    }),
    // Past appointments still marked pending/confirmed: mark them completed or no-show.
    prisma.booking.findMany({
      where: { resourceId: resource.id, endAt: { lt: now }, startAt: { lt: todayStart }, status: { in: ACTIVE_STATUSES } },
      select,
      orderBy: { startAt: "desc" },
      take: 20,
    }),
    prisma.workSchedule.findMany({ where: { resourceId: resource.id }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
  ]);

  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description={`Your bookings at ${resource.provider.businessName}.`} />

      {needsUpdate.length ? (
        <Card className="mb-6 border-amber-500/40">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle aria-hidden className="size-5 text-amber-600" />
            <CardTitle className="text-base">Update these past bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">Mark each one as completed or no-show.</p>
            <AppointmentList bookings={needsUpdate} showDate />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today · {formatDate(now)}</CardTitle>
            </CardHeader>
            <CardContent>
              {todays.length ? <AppointmentList bookings={todays} /> : <EmptyState title="Nothing booked today" />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Next 14 days</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <AppointmentList bookings={upcoming} showDate />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">My hours</CardTitle>
          </CardHeader>
          <CardContent>
            {schedules.length ? (
              <dl className="grid grid-cols-[3rem_1fr] gap-y-1 text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const shifts = schedules.filter((s) => s.dayOfWeek === day);
                  return (
                    <div key={day} className="contents">
                      <dt className="text-muted-foreground">{DAYS[day]}</dt>
                      <dd className="tabular-nums">
                        {shifts.length ? shifts.map((s) => `${s.startTime}–${s.endTime}`).join(", ") : "Off"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Your business hasn&apos;t set your hours yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
