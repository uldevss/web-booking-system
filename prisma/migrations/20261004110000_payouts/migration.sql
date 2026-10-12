-- Businesses cash out their net earnings to GCash; admins pay them out.
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

ALTER TABLE "Provider" ADD COLUMN "payoutGcashName" TEXT, ADD COLUMN "payoutGcashNumber" TEXT;

CREATE TABLE "Payout" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "gcashName" TEXT NOT NULL,
  "gcashNumber" TEXT NOT NULL,
  "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "reference" TEXT,
  "note" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payout_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payout_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "Payout_providerId_status_idx" ON "Payout"("providerId", "status");
