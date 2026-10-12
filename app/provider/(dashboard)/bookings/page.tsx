import type { Metadata } from "next";
import { BookingFilters } from "@/components/booking/booking-filters";
import { BookingList } from "@/components/booking/booking-list";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { bookingFilter, bookingOrder, PAGE_SIZE, pageNumber } from "@/lib/booking-filters";
import { resourceName } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Bookings" };

export default async function ProviderBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { provider } = await requireProvider();
  const params = flattenParams(await searchParams);
  const page = pageNumber(params);
  // Always scoped to this provider, whatever the URL says.
  const where = { ...bookingFilter({ ...params, provider: undefined }), providerId: provider.id };

  const [bookings, total, resources] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        service: { select: { name: true, bookingType: true } },
        customer: { select: { name: true } },
        resource: { select: { name: true, user: { select: { name: true } } } },
        payment: { select: { status: true } },
      },
      orderBy: bookingOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
    prisma.resource.findMany({
      where: { providerId: provider.id },
      select: { id: true, name: true, user: { select: { name: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHeader title="Bookings" description="Confirm requests, reassign rooms, tables or staff, record payments and update statuses." />
      <BookingFilters resources={resources.map((r) => ({ id: r.id, name: resourceName(r) }))} />
      {bookings.length ? (
        <>
          <BookingList bookings={bookings} hrefBase="/provider/bookings" columns={["customer", "resource", "payment"]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/provider/bookings" params={params} />
        </>
      ) : (
        <EmptyState
          title="No bookings match these filters"
          description="Upcoming bookings are shown by default. Switch to Past or All, or clear the filters."
        />
      )}
    </>
  );
}
