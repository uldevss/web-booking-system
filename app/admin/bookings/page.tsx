import type { Metadata } from "next";
import { BookingFilters } from "@/components/booking/booking-filters";
import { BookingList } from "@/components/booking/booking-list";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { bookingFilter, bookingOrder, PAGE_SIZE, pageNumber } from "@/lib/booking-filters";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "All bookings" };

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser(["ADMIN"]);
  const params = flattenParams(await searchParams);
  const page = pageNumber(params);
  const where = bookingFilter({ ...params, resource: undefined });

  const [bookings, total, providers] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        service: { select: { name: true, bookingType: true } },
        provider: { select: { businessName: true } },
        customer: { select: { name: true } },
        payment: { select: { status: true } },
      },
      orderBy: bookingOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
    prisma.provider.findMany({ select: { id: true, businessName: true }, orderBy: { businessName: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="All bookings" description={`${total} booking${total === 1 ? "" : "s"}`} />
      <BookingFilters providers={providers.map((p) => ({ id: p.id, name: p.businessName }))} />
      {bookings.length ? (
        <>
          <BookingList bookings={bookings} hrefBase="/admin/bookings" columns={["provider", "customer", "payment"]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/bookings" params={params} />
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
