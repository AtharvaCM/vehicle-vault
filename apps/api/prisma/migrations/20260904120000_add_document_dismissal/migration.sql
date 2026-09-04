-- CreateTable
CREATE TABLE "DocumentDismissal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "documentKind" VARCHAR(20) NOT NULL,
    "documentId" UUID NOT NULL,
    "dismissedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentDismissal_userId_dismissedUntil_idx" ON "DocumentDismissal"("userId", "dismissedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDismissal_userId_documentId_key" ON "DocumentDismissal"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "DocumentDismissal" ADD CONSTRAINT "DocumentDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
