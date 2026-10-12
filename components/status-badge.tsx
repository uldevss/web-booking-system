import type { BookingStatus, PaymentStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

const bookingStyles: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  NO_SHOW: { label: "No-show", className: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200" },
};

const paymentStyles: Record<PaymentStatus, { label: string; className: string }> = {
  UNPAID: { label: "Unpaid", className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  PARTIAL: { label: "Partially paid", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  PAID: { label: "Fully paid", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  REFUNDED: { label: "Refunded", className: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200" },
};

const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export const bookingStatusLabel = (status: BookingStatus) => bookingStyles[status].label;
export const paymentStatusLabel = (status: PaymentStatus) => paymentStyles[status].label;

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const style = bookingStyles[status];
  return <span className={cn(base, style.className, className)}>{style.label}</span>;
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const style = paymentStyles[status];
  return <span className={cn(base, style.className, className)}>{style.label}</span>;
}
