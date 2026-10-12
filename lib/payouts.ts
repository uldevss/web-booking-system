import "server-only";
import { AppError } from "./errors";
import { prisma } from "./prisma";

// Cash-outs: a business asks for its available balance (confirmed payments
// minus commission minus earlier payouts) to be sent to its GCash; the admin
// sends the money and records the GCash reference.

/** Net earnings so far, what has been (or is being) paid out, and what's left. */
export async function payoutBalance(providerId: string) {
  const [earned, paidOut] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: ["PAID", "PARTIAL"] }, booking: { providerId } },
      _sum: { amountPaid: true, commissionAmount: true },
    }),
    prisma.payout.aggregate({ where: { providerId, status: { in: ["REQUESTED", "PAID"] } }, _sum: { amount: true } }),
  ]);
  const net = Number(earned._sum.amountPaid ?? 0) - Number(earned._sum.commissionAmount ?? 0);
  const committed = Number(paidOut._sum.amount ?? 0);
  return {
    net: round(net),
    paidOut: round(committed),
    available: round(Math.max(0, net - committed)),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function requestPayout(providerId: string, input: { amount: string; gcashName: string; gcashNumber: string }) {
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new AppError("BAD_REQUEST", "Enter an amount to cash out.");
  const balance = await payoutBalance(providerId);
  if (amount > balance.available + 0.001) {
    throw new AppError("INVALID_STATE", `You can cash out up to ${balance.available.toFixed(2)} right now.`);
  }
  const pending = await prisma.payout.count({ where: { providerId, status: "REQUESTED" } });
  if (pending) throw new AppError("INVALID_STATE", "You already have a cash-out waiting. We'll process it first.");

  const [payout] = await prisma.$transaction([
    prisma.payout.create({ data: { providerId, amount: amount.toFixed(2), gcashName: input.gcashName, gcashNumber: input.gcashNumber } }),
    prisma.provider.update({ where: { id: providerId }, data: { payoutGcashName: input.gcashName, payoutGcashNumber: input.gcashNumber } }),
  ]);
  return payout;
}

export async function listPayouts(filter: { providerId?: string; status?: "REQUESTED" | "PAID" | "REJECTED" }) {
  return prisma.payout.findMany({
    where: { ...(filter.providerId ? { providerId: filter.providerId } : {}), ...(filter.status ? { status: filter.status } : {}) },
    include: { provider: { select: { id: true, businessName: true, ownerId: true } } },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
}

/** Admin marks a request as paid (with the GCash reference) or rejects it. */
export async function resolvePayout(
  input: { payoutId: string; decision: "paid"; reference: string } | { payoutId: string; decision: "rejected"; note: string },
) {
  const payout = await prisma.payout.findUnique({ where: { id: input.payoutId }, include: { provider: { select: { ownerId: true } } } });
  if (!payout) throw new AppError("NOT_FOUND", "Cash-out request not found.");
  if (payout.status !== "REQUESTED") throw new AppError("INVALID_STATE", "This request was already handled.");
  return prisma.payout.update({
    where: { id: payout.id },
    data:
      input.decision === "paid"
        ? { status: "PAID", reference: input.reference, resolvedAt: new Date() }
        : { status: "REJECTED", note: input.note, resolvedAt: new Date() },
    include: { provider: { select: { ownerId: true, businessName: true } } },
  });
}
