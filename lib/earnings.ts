import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "./prisma";

// Money view for a business: what guests paid in (confirmed by the business),
// the platform's commission, and the net the business receives. Guests pay the
// platform's GCash account, so "net" is what the platform owes the business.

export type EarningsFilter = { providerId?: string; from?: Date; to?: Date; /** Guest, option, business or GCash reference */ q?: string };

export async function getEarnings(filter: EarningsFilter) {
  const where: Prisma.PaymentWhereInput = {
    status: { in: ["PAID", "PARTIAL"] },
    ...(filter.providerId ? { booking: { providerId: filter.providerId } } : {}),
    ...(filter.from || filter.to ? { paidAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
  };
  const q = filter.q?.trim().slice(0, 100);
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { reference: contains },
      { booking: { customer: { name: contains } } },
      { booking: { customer: { email: contains } } },
      { booking: { service: { name: contains } } },
      { booking: { provider: { businessName: contains } } },
      { booking: { id: { endsWith: q.toLowerCase() } } },
    ];
  }

  const [rows, totals, pendingRows] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            startAt: true,
            priceAtBooking: true,
            customer: { select: { name: true } },
            service: { select: { name: true } },
            provider: { select: { id: true, businessName: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
    prisma.payment.aggregate({ where, _sum: { amountPaid: true, commissionAmount: true }, _count: { _all: true } }),
    // Paid, but the booking itself is still waiting for the business to confirm.
    prisma.payment.aggregate({
      where: {
        status: { in: ["PAID", "PARTIAL"] },
        booking: { status: "PENDING", ...(filter.providerId ? { providerId: filter.providerId } : {}) },
      },
      _sum: { amountPaid: true },
      _count: { _all: true },
    }),
  ]);

  const gross = Number(totals._sum.amountPaid ?? 0);
  const commission = Number(totals._sum.commissionAmount ?? 0);
  return {
    summary: {
      payments: totals._count._all,
      gross,
      commission,
      net: Math.round((gross - commission) * 100) / 100,
      awaitingCount: pendingRows._count._all,
      awaitingAmount: Number(pendingRows._sum.amountPaid ?? 0),
    },
    rows: rows.map((p) => ({
      id: p.id,
      bookingId: p.booking.id,
      paidAt: p.paidAt,
      startAt: p.booking.startAt,
      guest: p.booking.customer.name,
      option: p.booking.service.name,
      business: p.booking.provider.businessName,
      providerId: p.booking.provider.id,
      plan: p.plan,
      status: p.status,
      reference: p.reference,
      amountPaid: Number(p.amountPaid),
      commissionPercent: Number(p.commissionPercent),
      commission: Number(p.commissionAmount),
      net: Math.round((Number(p.amountPaid) - Number(p.commissionAmount)) * 100) / 100,
    })),
  };
}
