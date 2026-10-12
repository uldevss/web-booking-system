import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceServicesForm, ResourceStatusButton } from "@/app/provider/(dashboard)/resources/resource-forms";
import { PageHeader } from "@/components/page-header";
import { ScheduleEditor } from "@/components/schedule-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import { resourceKinds, resourceName } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Resource" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export default async function ResourcePage({ params, searchParams }: Props) {
  const { user, provider } = await requireProvider();
  const { id } = await params;
  const { created } = flattenParams(await searchParams);
  const [resource, services] = await Promise.all([
    prisma.resource.findFirst({
      where: { id, providerId: provider.id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        services: { select: { id: true, bookingType: true } },
        schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        _count: { select: { bookings: { where: { status: { in: ACTIVE_STATUSES }, endAt: { gt: new Date() } } } } },
      },
    }),
    prisma.service.findMany({
      where: { providerId: provider.id, isActive: true },
      select: { id: true, name: true, bookingType: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!resource) notFound();

  const isStaff = resource.kind === "STAFF";
  const usedForTimed = resource.services.some((service) => service.bookingType === "TIMED");
  const onlyStays = resource.services.length > 0 && !usedForTimed;

  return (
    <>
      <PageHeader
        title={`${resourceName(resource)}${resource.userId === user.id ? " (you)" : ""}`}
        description={
          <>
            <Link href="/provider/resources" className="text-primary hover:underline">
              ← Staff & resources
            </Link>
            <span className="ml-2">
              {resourceKinds[resource.kind].label}
              {resource.user ? ` · ${resource.user.email}${resource.user.phone ? ` · ${resource.user.phone}` : ""}` : ""}
            </span>
          </>
        }
        actions={<ResourceStatusButton resourceId={resource.id} isActive={resource.isActive} isStaff={isStaff} />}
      />

      {created ? (
        <p role="status" className="mb-6 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm">
          Added.{" "}
          {onlyStays
            ? "It's ready for overnight bookings."
            : "Now set its opening hours so guests can book times."}
        </p>
      ) : null}
      {!resource.isActive ? (
        <p className="mb-6 rounded-md border px-4 py-3 text-sm text-muted-foreground">
          Inactive: it gets no new bookings{isStaff ? " and the staff member can't log in" : ""}.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opening hours</CardTitle>
            <CardDescription>
              {onlyStays
                ? "Rooms and rental units booked by the night don't need hours: they can be booked for any night that's free."
                : "Guests can only book times inside these hours (used for tours, tables, escape rooms and venues)."}{" "}
              Changes don&apos;t affect existing bookings
              {resource._count.bookings ? ` (${resource._count.bookings} upcoming)` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleEditor
              resourceId={resource.id}
              initial={resource.schedules.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }))}
            />
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">Booking options</CardTitle>
            <CardDescription>Which options this {isStaff ? "person handles" : "can be booked for"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResourceServicesForm
              resourceId={resource.id}
              services={services.map(({ id, name }) => ({ id, name }))}
              assigned={resource.services.map((s) => s.id)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
