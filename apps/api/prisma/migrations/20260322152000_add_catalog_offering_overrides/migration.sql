-- CreateTable
CREATE TABLE "VehicleCatalogVariantOfferingOverride" (
  "id" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "sourceName" VARCHAR(80) NOT NULL,
  "fuelTypeSignature" VARCHAR(80) NOT NULL,
  "reviewNote" TEXT,
  "manualYearStart" INTEGER,
  "manualYearEnd" INTEGER,
  "manualIsCurrent" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleCatalogVariantOfferingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogVariantOfferingOverride_variantId_sourceName_fuelT_key"
ON "VehicleCatalogVariantOfferingOverride"("variantId", "sourceName", "fuelTypeSignature");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariantOfferingOverride_sourceName_idx"
ON "VehicleCatalogVariantOfferingOverride"("sourceName");

-- AddForeignKey
ALTER TABLE "VehicleCatalogVariantOfferingOverride"
ADD CONSTRAINT "VehicleCatalogVariantOfferingOverride_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
