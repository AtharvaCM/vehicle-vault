-- Make passwordHash nullable so OAuth-only users can exist without a credential.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Provider enum for linked external identities.
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'github');

CREATE TABLE "OAuthAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "provider" "OAuthProvider" NOT NULL,
  "providerAccountId" VARCHAR(190) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key"
  ON "OAuthAccount" ("provider", "providerAccountId");

CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount" ("userId");
