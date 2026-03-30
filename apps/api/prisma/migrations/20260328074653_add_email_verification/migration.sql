-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationTokenHash" CHAR(64),
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;
