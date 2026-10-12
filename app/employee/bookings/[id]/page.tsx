import type { Metadata } from "next";
import Link from "next/link";
import { BookingDetail, loadBooking } from "@/components/booking/booking-detail";
import { PageHeader } from "@/components/page-header";
import { requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Booking" };

export default async function EmployeeBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireStaff();
  const booking = await loadBooking((await params).id, user);
  return (
    <>
      <PageHeader
        title="Booking"
        description={
          <Link href="/employee" className="text-primary hover:underline">
            ← My bookings
          </Link>
        }
      />
      <BookingDetail booking={booking} actor={user} />
    </>
  );
}
