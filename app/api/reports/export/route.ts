import { handle } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { bookingsCsv } from "@/lib/reports";
import { requireApiUser } from "@/lib/session";
import { reportQuerySchema } from "@/lib/validators";

/**
 * GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD[&providerId=]
 * CSV of bookings in the range. Providers always get only their own business.
 */
export const GET = handle(async (request: Request) => {
  const user = await requireApiUser(["PROVIDER", "ADMIN"]);
  const query = reportQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

  let providerId = query.providerId;
  if (user.role === "PROVIDER") {
    const provider = await prisma.provider.findUnique({ where: { ownerId: user.id }, select: { id: true } });
    if (!provider) throw new AppError("NOT_FOUND", "Business not found.");
    providerId = provider.id;
  }

  const csv = await bookingsCsv({ from: query.from, to: query.to, providerId });
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${query.from}-to-${query.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
