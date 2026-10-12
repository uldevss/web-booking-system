import Link from "next/link";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nightsBetween, resourceName } from "@/lib/catalog";
import type { BookingStatus, BookingType, PaymentStatus } from "@/lib/generated/prisma/enums";
import { formatDate, formatMoney, formatTime } from "@/lib/format";

export type BookingRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  guests?: number;
  status: BookingStatus;
  priceAtBooking: { toString(): string };
  service: { name: string; bookingType: BookingType };
  provider?: { businessName: string };
  customer?: { name: string };
  resource?: { name: string | null; user: { name: string } | null } | null;
  payment?: { status: PaymentStatus } | null;
};

type Column = "provider" | "customer" | "resource" | "payment";

/** Bookings table; `hrefBase` + id links each row to its detail page. */
export function BookingList({
  bookings,
  hrefBase,
  columns,
}: {
  bookings: BookingRow[];
  hrefBase: string;
  columns: Column[];
}) {
  const show = (column: Column) => columns.includes(column);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Option</TableHead>
            {show("provider") ? <TableHead>Business</TableHead> : null}
            {show("customer") ? <TableHead>Customer</TableHead> : null}
            {show("resource") ? <TableHead>Assigned to</TableHead> : null}
            <TableHead>Status</TableHead>
            {show("payment") ? <TableHead>Payment</TableHead> : null}
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id} className="relative">
              <TableCell className="whitespace-nowrap">
                <Link href={`${hrefBase}/${booking.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                  {formatDate(booking.startAt)}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {booking.service.bookingType === "NIGHTLY"
                    ? `${nightsBetween(booking.startAt, booking.endAt)} night${nightsBetween(booking.startAt, booking.endAt) === 1 ? "" : "s"}`
                    : formatTime(booking.startAt)}
                  {booking.guests ? ` · ${booking.guests} guest${booking.guests === 1 ? "" : "s"}` : ""}
                </span>
              </TableCell>
              <TableCell>{booking.service.name}</TableCell>
              {show("provider") ? <TableCell>{booking.provider?.businessName}</TableCell> : null}
              {show("customer") ? <TableCell>{booking.customer?.name}</TableCell> : null}
              {show("resource") ? (
                <TableCell>
                  {booking.resource ? resourceName(booking.resource) : <span className="text-muted-foreground">Unassigned</span>}
                </TableCell>
              ) : null}
              <TableCell>
                <BookingStatusBadge status={booking.status} />
              </TableCell>
              {show("payment") ? (
                <TableCell>
                  <PaymentStatusBadge status={booking.payment?.status ?? "UNPAID"} />
                </TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">{formatMoney(booking.priceAtBooking)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
