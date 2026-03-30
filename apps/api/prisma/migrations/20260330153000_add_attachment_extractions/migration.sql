-- CreateEnum
CREATE TYPE "AttachmentExtractionStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "AttachmentExtraction" (
    "id" UUID NOT NULL,
    "attachmentId" UUID NOT NULL,
    "status" "AttachmentExtractionStatus" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(40),
    "confidence" DECIMAL(4,3),
    "vendorName" VARCHAR(120),
    "workshopName" VARCHAR(120),
    "invoiceNumber" VARCHAR(120),
    "documentDate" TIMESTAMP(3),
    "serviceDate" TIMESTAMP(3),
    "odometer" INTEGER,
    "totalCost" DECIMAL(12,2),
    "currencyCode" VARCHAR(3),
    "notes" TEXT,
    "lineItems" JSONB,
    "failureReason" TEXT,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttachmentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentExtraction_attachmentId_key" ON "AttachmentExtraction"("attachmentId");

-- CreateIndex
CREATE INDEX "AttachmentExtraction_status_extractedAt_idx" ON "AttachmentExtraction"("status", "extractedAt" DESC);

-- AddForeignKey
ALTER TABLE "AttachmentExtraction" ADD CONSTRAINT "AttachmentExtraction_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
