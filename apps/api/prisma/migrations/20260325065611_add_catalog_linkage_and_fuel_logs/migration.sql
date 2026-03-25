-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "catalogVariantId" UUID;

-- CreateTable
CREATE TABLE "FuelLog" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "location" VARCHAR(120),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelLog_vehicleId_date_idx" ON "FuelLog"("vehicleId", "date" DESC);

-- CreateIndex
CREATE INDEX "Vehicle_catalogVariantId_idx" ON "Vehicle"("catalogVariantId");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_catalogVariantId_fkey" FOREIGN KEY ("catalogVariantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelLog" ADD CONSTRAINT "FuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
