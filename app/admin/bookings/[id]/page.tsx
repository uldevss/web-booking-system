import type { Metadata } from "next";
import Link from "next/link";
import { BookingDetail, loadBooking } from "@/components/booking/booking-detail";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["ADMIN"]);
  const booking = await loadBooking((await params).id, user);
  return (
    <>
      <PageHeader
        title="Booking details"
        description={
          <Link href="/admin/bookings" className="text-primary hover:underline">
            ← All bookings
          </Link>
        }
      />
      <BookingDetail booking={booking} actor={user} />
    </>
  );
}
