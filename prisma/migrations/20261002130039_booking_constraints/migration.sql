-- Database-level rules Prisma's schema language can't express.

-- A resource's PENDING/CONFIRMED bookings can never overlap: no two parties
-- in the same room, table, space or tour guide at once, including across
-- nights for hotel stays. This is the last line of defence against double
-- booking, whatever code path writes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("resourceId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
  WHERE ("resourceId" IS NOT NULL AND "status" IN ('PENDING', 'CONFIRMED'));

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ends_after_start" CHECK ("endAt" > "startAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guests_positive" CHECK ("guests" >= 1);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_1_to_5" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Service" ADD CONSTRAINT "Service_duration_positive" CHECK ("durationMin" IS NULL OR "durationMin" > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_max_guests_positive" CHECK ("maxGuests" >= 1);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_not_negative" CHECK ("price" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_not_negative" CHECK ("amountPaid" >= 0);
