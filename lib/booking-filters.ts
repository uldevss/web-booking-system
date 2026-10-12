import type { BookingStatus, Prisma } from "@/lib/generated/prisma/client";
import { siteConfig } from "./config";
import { dayBounds, isDayKey } from "./time";

// Turns list filters from the URL (?when=&status=&q=&from=&to=&resource=&provider=&page=)
// into a Prisma query. Unknown values are ignored rather than trusted.

export type BookingSearchParams = {
  when?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  resource?: string;
  provider?: string;
  page?: string;
};

export type BookingView = "upcoming" | "past" | "all";

const STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
export const PAGE_SIZE = 25;

/**
 * Which slice of time the list shows. Upcoming is the default so new requests
 * are near the top; picking a date range switches to "all" within that range.
 */
export function bookingView(params: BookingSearchParams): BookingView {
  if (params.when === "upcoming" || params.when === "past" || params.when === "all") return params.when;
  return params.from || params.to ? "all" : "upcoming";
}

export function bookingFilter(params: BookingSearchParams, now = new Date()): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  if (params.status && STATUSES.includes(params.status as BookingStatus)) where.status = params.status as BookingStatus;
  if (params.resource) where.resourceId = params.resource;
  if (params.provider) where.providerId = params.provider;

  const view = bookingView(params);
  if (view === "upcoming") where.endAt = { gte: now };
  if (view === "past") where.endAt = { lt: now };

  const startAt: Prisma.DateTimeFilter = {};
  if (params.from && isDayKey(params.from)) startAt.gte = dayBounds(params.from, siteConfig.timeZone).start;
  if (params.to && isDayKey(params.to)) startAt.lt = dayBounds(params.to, siteConfig.timeZone).end;
  if (startAt.gte || startAt.lt) where.startAt = startAt;

  // Guest name or email, or the short booking code shown on the booking page.
  const q = params.q?.trim().slice(0, 100);
  if (q) {
    where.OR = [
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { id: { endsWith: q.toLowerCase() } },
    ];
  }
  return where;
}

/** Upcoming lists read soonest-first; everything else newest-first. */
export function bookingOrder(params: BookingSearchParams): Prisma.BookingOrderByWithRelationInput {
  return { startAt: bookingView(params) === "upcoming" ? "asc" : "desc" };
}

export function pageNumber(params: { page?: string }) {
  const page = Number.parseInt(params.page ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
