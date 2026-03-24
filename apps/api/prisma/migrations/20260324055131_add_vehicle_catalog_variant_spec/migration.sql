-- CreateTable
CREATE TABLE "VehicleCatalogVariantSpec" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "engineCc" INTEGER,
    "engineCyl" INTEGER,
    "engineType" VARCHAR(60),
    "engineFuel" VARCHAR(60),
    "powerPs" DOUBLE PRECISION,
    "powerRpm" INTEGER,
    "torqueNm" DOUBLE PRECISION,
    "torqueRpm" INTEGER,
    "transmission" VARCHAR(80),
    "driveType" VARCHAR(40),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "wheelbaseMm" INTEGER,
    "kerbWeightKg" INTEGER,
    "grossWeightKg" INTEGER,
    "bootSpaceLitres" INTEGER,
    "groundClearanceMm" INTEGER,
    "turningRadiusM" DOUBLE PRECISION,
    "topSpeedKph" INTEGER,
    "mileageCity" DOUBLE PRECISION,
    "mileageHighway" DOUBLE PRECISION,
    "mileageCombined" DOUBLE PRECISION,
    "fuelCapLitres" DOUBLE PRECISION,
    "seatingCapacity" INTEGER,
    "bodyType" VARCHAR(40),
    "doors" INTEGER,
    "tyreSize" VARCHAR(60),
    "wheelType" VARCHAR(40),
    "wheelSizeInch" DOUBLE PRECISION,
    "airbagCount" INTEGER,
    "safetyFeatures" TEXT,
    "sourceName" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogVariantSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogVariantSpec_variantId_key" ON "VehicleCatalogVariantSpec"("variantId");

-- AddForeignKey
ALTER TABLE "VehicleCatalogVariantSpec" ADD CONSTRAINT "VehicleCatalogVariantSpec_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
