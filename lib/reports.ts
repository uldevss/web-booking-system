import "server-only";
import { Prisma, type BookingStatus } from "@/lib/generated/prisma/client";
import { categoryLabel, resourceName } from "./catalog";
import { siteConfig } from "./config";
import { prisma } from "./prisma";
import { dayBounds, periodStarts, type Period } from "./time";

// Reporting queries for providers (scoped to their business) and admins
// (platform-wide or one provider). Dates are grouped by the platform's local
// calendar, not UTC.

export type GroupBy = Period;
export type ReportFilter = { from: string; to: string; groupBy: GroupBy; providerId?: string };

const TZ = siteConfig.timeZone;
const STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

const localTime = (column: Prisma.Sql) => Prisma.sql`(${column} AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})`;
const providerFilter = (providerId?: string) =>
  providerId ? Prisma.sql`AND b."providerId" = ${providerId}` : Prisma.empty;

/** "2026-10-05T00:00:00.000Z" (a local-midnight timestamp read back as UTC) -> "2026-10-05" */
const toKey = (bucket: Date) => bucket.toISOString().slice(0, 10);

export async function getReport(filter: ReportFilter) {
  const start = dayBounds(filter.from, TZ).start;
  const end = dayBounds(filter.to, TZ).end;
  const unit = filter.groupBy;
  const byProvider = providerFilter(filter.providerId);

  const [revenueRows, statusRows, serviceRows, ratingRows, resourceRows] = await Promise.all([
    prisma.$queryRaw<{ bucket: Date; revenue: number }[]>`
      SELECT date_trunc(${unit}, ${localTime(Prisma.sql`p."paidAt"`)}) AS bucket,
             SUM(p."amountPaid")::float AS revenue
      FROM "Payment" p JOIN "Booking" b ON b."id" = p."bookingId"
      WHERE p."status" IN ('PAID', 'PARTIAL') AND p."paidAt" >= ${start} AND p."paidAt" < ${end} ${byProvider}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ bucket: Date; status: BookingStatus; count: number }[]>`
      SELECT date_trunc(${unit}, ${localTime(Prisma.sql`b."startAt"`)}) AS bucket, b."status", COUNT(*)::int AS count
      FROM "Booking" b
      WHERE b."startAt" >= ${start} AND b."startAt" < ${end} ${byProvider}
      GROUP BY 1, 2 ORDER BY 1`,
    prisma.$queryRaw<{ id: string; name: string; businessName: string; bookings: number; completed: number; value: number }[]>`
      SELECT s."id", s."name", pr."businessName",
             COUNT(*)::int AS bookings,
             COUNT(*) FILTER (WHERE b."status" = 'COMPLETED')::int AS completed,
             COALESCE(SUM(b."priceAtBooking") FILTER (WHERE b."status" = 'COMPLETED'), 0)::float AS value
      FROM "Booking" b
      JOIN "Service" s ON s."id" = b."serviceId"
      JOIN "Provider" pr ON pr."id" = b."providerId"
      WHERE b."startAt" >= ${start} AND b."startAt" < ${end} AND b."status" <> 'CANCELLED' ${byProvider}
      GROUP BY s."id", s."name", pr."businessName"
      ORDER BY bookings DESC, value DESC
      LIMIT 10`,
    prisma.$queryRaw<{ average: number | null; count: number }[]>`
      SELECT AVG(r."rating")::float AS average, COUNT(*)::int AS count
      FROM "Review" r JOIN "Booking" b ON b."id" = r."bookingId"
      WHERE r."isHidden" = false AND r."createdAt" >= ${start} AND r."createdAt" < ${end} ${byProvider}`,
    // Utilization per room, unit, table, space or staff member: completed
    // bookings, plus the time they were in use (nights for stays, hours otherwise).
    filter.providerId
      ? prisma.$queryRaw<
          { id: string; name: string; kind: string; completed: number; noShows: number; hours: number; nights: number }[]
        >`
          SELECT r."id", COALESCE(r."name", u."name", 'Unnamed') AS name, r."kind"::text AS kind,
                 COUNT(b."id") FILTER (WHERE b."status" = 'COMPLETED')::int AS completed,
                 COUNT(b."id") FILTER (WHERE b."status" = 'NO_SHOW')::int AS "noShows",
                 COALESCE(SUM(EXTRACT(EPOCH FROM (b."endAt" - b."startAt")) / 3600)
                   FILTER (WHERE b."status" = 'COMPLETED' AND s."bookingType" = 'TIMED'), 0)::float AS hours,
                 COALESCE(SUM(ROUND(EXTRACT(EPOCH FROM (b."endAt" - b."startAt")) / 86400))
                   FILTER (WHERE b."status" = 'COMPLETED' AND s."bookingType" = 'NIGHTLY'), 0)::int AS nights
          FROM "Resource" r
          LEFT JOIN "User" u ON u."id" = r."userId"
          LEFT JOIN "Booking" b ON b."resourceId" = r."id" AND b."startAt" >= ${start} AND b."startAt" < ${end}
          LEFT JOIN "Service" s ON s."id" = b."serviceId"
          WHERE r."providerId" = ${filter.providerId}
          GROUP BY r."id", r."name", u."name", r."kind"
          ORDER BY completed DESC, name`
      : Promise.resolve([]),
  ]);

  const keys = periodStarts(filter.from, filter.to, unit);
  const revenueByKey = new Map(revenueRows.map((row) => [toKey(row.bucket), row.revenue]));
  const statusByKey = new Map<string, Record<BookingStatus, number>>();
  const totals = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>;
  for (const row of statusRows) {
    const key = toKey(row.bucket);
    const counts = statusByKey.get(key) ?? (Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>);
    counts[row.status] += row.count;
    totals[row.status] += row.count;
    statusByKey.set(key, counts);
  }

  const totalBookings = STATUSES.reduce((sum, status) => sum + totals[status], 0);
  const revenue = revenueRows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    filter,
    summary: {
      revenue,
      bookings: totalBookings,
      completed: totals.COMPLETED,
      cancellationRate: totalBookings ? totals.CANCELLED / totalBookings : 0,
      noShowRate: totalBookings ? totals.NO_SHOW / totalBookings : 0,
      averageRating: ratingRows[0]?.average ?? null,
      reviews: ratingRows[0]?.count ?? 0,
    },
    statusTotals: totals,
    revenueSeries: keys.map((key) => ({ key, revenue: revenueByKey.get(key) ?? 0 })),
    bookingSeries: keys.map((key) => ({
      key,
      ...(statusByKey.get(key) ?? (Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<BookingStatus, number>)),
    })),
    topServices: serviceRows,
    resources: resourceRows,
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;

// ── CSV export ──────────────────────────────────────────────────────────────

/** Quotes a CSV cell and defuses spreadsheet formulas (=, +, -, @). */
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function bookingsCsv(filter: Omit<ReportFilter, "groupBy">) {
  const start = dayBounds(filter.from, TZ).start;
  const end = dayBounds(filter.to, TZ).end;
  const bookings = await prisma.booking.findMany({
    where: { startAt: { gte: start, lt: end }, ...(filter.providerId ? { providerId: filter.providerId } : {}) },
    orderBy: { startAt: "asc" },
    include: {
      provider: { select: { businessName: true, category: true } },
      service: { select: { name: true } },
      resource: { select: { name: true, user: { select: { name: true } } } },
      customer: { select: { name: true, email: true } },
      payment: true,
      review: { select: { rating: true } },
    },
  });

  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const header = [
    "Booking ID", "Start / check-in", "End / check-out", "Business", "Category", "Option", "Assigned to",
    "Guests", "Customer", "Customer email", "Status", "Price", "Payment status", "Amount paid", "Method",
    "Reference", "Rating",
  ];
  const rows = bookings.map((b) => [
    b.id,
    stamp.format(b.startAt),
    stamp.format(b.endAt),
    b.provider.businessName,
    categoryLabel(b.provider.category),
    b.service.name,
    b.resource ? resourceName(b.resource) : "",
    b.guests,
    b.customer.name,
    b.customer.email,
    b.status,
    b.priceAtBooking.toString(),
    b.payment?.status ?? "UNPAID",
    b.payment?.amountPaid.toString() ?? "0",
    b.payment?.method ?? "",
    b.payment?.reference ?? "",
    b.review?.rating ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
