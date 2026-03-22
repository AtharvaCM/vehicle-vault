-- CreateTable
CREATE TABLE "VehicleCatalogMake" (
    "id" UUID NOT NULL,
    "marketCode" VARCHAR(2) NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "sourceName" VARCHAR(80),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogMake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogModel" (
    "id" UUID NOT NULL,
    "makeId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "sourceName" VARCHAR(80),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogVariant" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "fuelTypes" "FuelType"[],
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "sourceName" VARCHAR(80),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogMake_marketCode_vehicleType_slug_key" ON "VehicleCatalogMake"("marketCode", "vehicleType", "slug");

-- CreateIndex
CREATE INDEX "VehicleCatalogMake_marketCode_vehicleType_name_idx" ON "VehicleCatalogMake"("marketCode", "vehicleType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogModel_makeId_slug_key" ON "VehicleCatalogModel"("makeId", "slug");

-- CreateIndex
CREATE INDEX "VehicleCatalogModel_makeId_name_idx" ON "VehicleCatalogModel"("makeId", "name");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariant_modelId_name_idx" ON "VehicleCatalogVariant"("modelId", "name");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariant_modelId_yearStart_yearEnd_idx" ON "VehicleCatalogVariant"("modelId", "yearStart", "yearEnd");

-- AddForeignKey
ALTER TABLE "VehicleCatalogModel" ADD CONSTRAINT "VehicleCatalogModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleCatalogMake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCatalogVariant" ADD CONSTRAINT "VehicleCatalogVariant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleCatalogModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
