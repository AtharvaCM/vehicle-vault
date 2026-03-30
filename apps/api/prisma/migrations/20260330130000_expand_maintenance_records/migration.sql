-- CreateEnum
CREATE TYPE "MaintenanceSource" AS ENUM ('manual', 'ocr', 'csv', 'api');

-- CreateEnum
CREATE TYPE "MaintenanceRecordStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "MaintenanceLineItemKind" AS ENUM ('job', 'part', 'fluid', 'labor', 'fee', 'tax', 'discount', 'other');

-- AlterTable
ALTER TABLE "MaintenanceRecord"
ADD COLUMN     "invoiceNumber" VARCHAR(120),
ADD COLUMN     "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'INR',
ADD COLUMN     "source" "MaintenanceSource" NOT NULL DEFAULT 'manual',
ADD COLUMN     "status" "MaintenanceRecordStatus" NOT NULL DEFAULT 'confirmed',
ADD COLUMN     "laborCost" DECIMAL(12,2),
ADD COLUMN     "partsCost" DECIMAL(12,2),
ADD COLUMN     "fluidsCost" DECIMAL(12,2),
ADD COLUMN     "taxCost" DECIMAL(12,2),
ADD COLUMN     "discountAmount" DECIMAL(12,2),
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "MaintenanceLineItem" (
    "id" UUID NOT NULL,
    "maintenanceRecordId" UUID NOT NULL,
    "kind" "MaintenanceLineItemKind" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "normalizedCategory" "MaintenanceCategory",
    "quantity" DECIMAL(10,2),
    "unit" VARCHAR(24),
    "unitPrice" DECIMAL(12,2),
    "lineTotal" DECIMAL(12,2),
    "brand" VARCHAR(80),
    "partNumber" VARCHAR(80),
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_status_serviceDate_idx" ON "MaintenanceRecord"("vehicleId", "status", "serviceDate" DESC);

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_invoiceNumber_idx" ON "MaintenanceRecord"("vehicleId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "MaintenanceLineItem_maintenanceRecordId_position_idx" ON "MaintenanceLineItem"("maintenanceRecordId", "position");

-- CreateIndex
CREATE INDEX "MaintenanceLineItem_maintenanceRecordId_kind_idx" ON "MaintenanceLineItem"("maintenanceRecordId", "kind");

-- CreateIndex
CREATE INDEX "MaintenanceLineItem_normalizedCategory_idx" ON "MaintenanceLineItem"("normalizedCategory");

-- AddForeignKey
ALTER TABLE "MaintenanceLineItem" ADD CONSTRAINT "MaintenanceLineItem_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "MaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
