import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { AppError } from "./errors";
import { prisma } from "./prisma";

// One review per completed booking, written by its customer.

export async function createReview(input: {
  bookingId: string;
  customerId: string;
  rating: number;
  comment?: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, customerId: input.customerId },
    select: { id: true, status: true, review: { select: { id: true } } },
  });
  if (!booking) throw new AppError("NOT_FOUND", "Booking not found.");
  if (booking.status !== "COMPLETED") {
    throw new AppError("INVALID_STATE", "You can review a booking once it's completed.");
  }
  if (booking.review) throw new AppError("INVALID_STATE", "You've already reviewed this booking.");

  try {
    return await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: input.customerId,
        rating: input.rating,
        comment: input.comment,
      },
    });
  } catch (error) {
    // Two submissions at once: the unique bookingId lets only one through.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("INVALID_STATE", "You've already reviewed this booking.");
    }
    throw error;
  }
}

/** Average rating and count of visible reviews, for one provider or each of several. */
export async function providerRatings(providerIds: string[]) {
  if (!providerIds.length) return new Map<string, { average: number; count: number }>();
  const rows = await prisma.$queryRaw<{ providerId: string; average: number; count: bigint }[]>`
    SELECT b."providerId", AVG(r."rating")::float AS "average", COUNT(*) AS "count"
    FROM "Review" r JOIN "Booking" b ON b."id" = r."bookingId"
    WHERE r."isHidden" = false AND b."providerId" IN (${Prisma.join(providerIds)})
    GROUP BY b."providerId"`;
  return new Map(rows.map((row) => [row.providerId, { average: Number(row.average), count: Number(row.count) }]));
}

export async function providerRating(providerId: string) {
  return (await providerRatings([providerId])).get(providerId) ?? { average: 0, count: 0 };
}
