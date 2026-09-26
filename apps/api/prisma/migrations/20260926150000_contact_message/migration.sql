-- Messages from the public Contact page (#341).
CREATE TABLE "ContactMessage" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt" DESC);

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: Prisma
-- connects as the `postgres` role, which bypasses it, so no policies are defined.
ALTER TABLE "ContactMessage" ENABLE ROW LEVEL SECURITY;
