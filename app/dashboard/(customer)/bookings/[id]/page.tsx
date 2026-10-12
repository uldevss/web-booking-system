import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookingDetail, loadBooking } from "@/components/booking/booking-detail";
import { PageHeader } from "@/components/page-header";
import { flattenParams, type SearchParams } from "@/lib/search-params";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Booking" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export default async function CustomerBookingPage({ params, searchParams }: Props) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await params;
  const { booked } = flattenParams(await searchParams);
  const booking = await loadBooking(id, user);

  return (
    <>
      <PageHeader
        title="Booking details"
        description={
          <Link href="/dashboard/bookings" className="text-primary hover:underline">
            ← All bookings
          </Link>
        }
      />
      {booked ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-4 text-sm">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">Booking received!</p>
            <p className="text-muted-foreground">
              We&apos;ve sent the details to {user.email}. You&apos;ll get another notification when {booking.provider.businessName}{" "}
              confirms it.
            </p>
          </div>
        </div>
      ) : null}
      <BookingDetail booking={booking} actor={user} />
    </>
  );
}
