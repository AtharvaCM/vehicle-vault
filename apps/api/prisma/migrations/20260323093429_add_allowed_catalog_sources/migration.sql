-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowedCatalogSources" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "VehicleCatalogGeneration" ALTER COLUMN "isCurrent" SET DEFAULT false;

-- RenameIndex
ALTER INDEX "VehicleCatalogVariantOfferingOverride_variantId_sourceName_fuel" RENAME TO "VehicleCatalogVariantOfferingOverride_variantId_sourceName__key";
