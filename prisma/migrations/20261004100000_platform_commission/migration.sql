-- Platform GCash details + commission on each confirmed payment.
CREATE TABLE "PlatformSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "gcashName" TEXT NOT NULL DEFAULT 'Booking System Payments',
  "gcashNumber" TEXT NOT NULL DEFAULT '0917 123 4567',
  "gcashQrUrl" TEXT,
  "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "PlatformSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

ALTER TABLE "Payment"
  ADD COLUMN "commissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Existing confirmed payments: apply the default 5% commission.
UPDATE "Payment" SET "commissionPercent" = 5, "commissionAmount" = ROUND("amountPaid" * 0.05, 2)
  WHERE "status" IN ('PAID', 'PARTIAL');
