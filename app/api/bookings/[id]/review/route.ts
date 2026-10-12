import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { createReview } from "@/lib/reviews";
import { requireApiUser } from "@/lib/session";
import { reviewSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

/** POST /api/bookings/:id/review: one review per completed booking, by its customer. */
export const POST = handle(async (request: Request, { params }: Context) => {
  const user = await requireApiUser(["CUSTOMER"]);
  const input = reviewSchema.parse(await readJson(request));
  const review = await createReview({ bookingId: (await params).id, customerId: user.id, ...input });
  return NextResponse.json(
    { review: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt } },
    { status: 201 },
  );
});
