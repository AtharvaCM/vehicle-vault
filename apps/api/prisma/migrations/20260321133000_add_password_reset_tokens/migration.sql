ALTER TABLE "User"
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetTokenHash" CHAR(64);
