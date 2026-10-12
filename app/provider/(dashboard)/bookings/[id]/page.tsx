import type { Metadata } from "next";
import Link from "next/link";
import { BookingDetail, loadBooking } from "@/components/booking/booking-detail";
import { PageHeader } from "@/components/page-header";
import { requireProvider } from "@/lib/session";

export const metadata: Metadata = { title: "Booking" };

export default async function ProviderBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireProvider();
  const booking = await loadBooking((await params).id, user);
  return (
    <>
      <PageHeader
        title="Booking details"
        description={
          <Link href="/provider/bookings" className="text-primary hover:underline">
            ← All bookings
          </Link>
        }
      />
      <BookingDetail booking={booking} actor={user} />
    </>
  );
}
