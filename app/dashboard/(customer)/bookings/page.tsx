import type { Metadata } from "next";
import Link from "next/link";
import { BookingList } from "@/components/booking/booking-list";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ACTIVE_STATUSES } from "@/lib/bookings";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My bookings" };

const tabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "History" },
  { key: "cancelled", label: "Cancelled" },
] as const;
type Tab = (typeof tabs)[number]["key"];

export default async function CustomerBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser(["CUSTOMER"]);
  const requested = flattenParams(await searchParams).tab;
  const tab: Tab = tabs.some((t) => t.key === requested) ? (requested as Tab) : "upcoming";
  const now = new Date();

  const where: Record<Tab, Prisma.BookingWhereInput> = {
    upcoming: { status: { in: ACTIVE_STATUSES }, endAt: { gt: now } },
    past: { OR: [{ status: { in: ["COMPLETED", "NO_SHOW"] } }, { status: { in: ACTIVE_STATUSES }, endAt: { lte: now } }] },
    cancelled: { status: "CANCELLED" },
  };

  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id, ...where[tab] },
    include: {
      service: { select: { name: true, bookingType: true } },
      provider: { select: { businessName: true } },
      payment: { select: { status: true } },
    },
    orderBy: { startAt: tab === "upcoming" ? "asc" : "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="My bookings" />
      <nav aria-label="Booking filters" className="mb-4 flex gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/bookings?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {bookings.length ? (
        <BookingList bookings={bookings} hrefBase="/dashboard/bookings" columns={["provider", "payment"]} />
      ) : (
        <EmptyState
          title={tab === "upcoming" ? "No upcoming bookings" : tab === "past" ? "No past bookings yet" : "No cancelled bookings"}
          action={
            tab === "upcoming" ? (
              <Button asChild variant="outline">
                <Link href="/services">Find something to book</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}
