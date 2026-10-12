-- Email ownership check at sign-up.
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailCodeHash" TEXT,
  ADD COLUMN "emailCodeExpiresAt" TIMESTAMP(3);

-- Accounts that already exist keep working.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
