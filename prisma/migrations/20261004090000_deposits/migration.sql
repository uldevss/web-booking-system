-- Guests pay a deposit (or the full amount) when booking; the business confirms it.
CREATE TYPE "PaymentPlan" AS ENUM ('DEPOSIT', 'FULL');

ALTER TABLE "Provider" ADD COLUMN "paymentInstructions" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN "plan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "amountDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Existing payments: treat what was recorded as what was due.
UPDATE "Payment" p SET "amountDue" = b."priceAtBooking", "plan" = CASE WHEN p."status" = 'PARTIAL' THEN 'DEPOSIT'::"PaymentPlan" ELSE 'FULL'::"PaymentPlan" END
  FROM "Booking" b WHERE b."id" = p."bookingId";
UPDATE "Payment" p SET "amountDue" = p."amountPaid" WHERE p."status" = 'PARTIAL';
