-- CreateTable
CREATE TABLE "VehicleCatalogMakeAlias" (
  "id" UUID NOT NULL,
  "makeId" UUID NOT NULL,
  "alias" VARCHAR(160) NOT NULL,
  "normalizedAlias" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleCatalogMakeAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogModelAlias" (
  "id" UUID NOT NULL,
  "modelId" UUID NOT NULL,
  "alias" VARCHAR(160) NOT NULL,
  "normalizedAlias" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleCatalogModelAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogGenerationAlias" (
  "id" UUID NOT NULL,
  "generationId" UUID NOT NULL,
  "alias" VARCHAR(180) NOT NULL,
  "normalizedAlias" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleCatalogGenerationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogVariantAlias" (
  "id" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "alias" VARCHAR(180) NOT NULL,
  "normalizedAlias" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleCatalogVariantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogMakeAlias_makeId_normalizedAlias_key" ON "VehicleCatalogMakeAlias"("makeId", "normalizedAlias");
CREATE INDEX "VehicleCatalogMakeAlias_normalizedAlias_idx" ON "VehicleCatalogMakeAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogModelAlias_modelId_normalizedAlias_key" ON "VehicleCatalogModelAlias"("modelId", "normalizedAlias");
CREATE INDEX "VehicleCatalogModelAlias_normalizedAlias_idx" ON "VehicleCatalogModelAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogGenerationAlias_generationId_normalizedAlias_key" ON "VehicleCatalogGenerationAlias"("generationId", "normalizedAlias");
CREATE INDEX "VehicleCatalogGenerationAlias_normalizedAlias_idx" ON "VehicleCatalogGenerationAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogVariantAlias_variantId_normalizedAlias_key" ON "VehicleCatalogVariantAlias"("variantId", "normalizedAlias");
CREATE INDEX "VehicleCatalogVariantAlias_normalizedAlias_idx" ON "VehicleCatalogVariantAlias"("normalizedAlias");

-- AddForeignKey
ALTER TABLE "VehicleCatalogMakeAlias"
ADD CONSTRAINT "VehicleCatalogMakeAlias_makeId_fkey"
FOREIGN KEY ("makeId") REFERENCES "VehicleCatalogMake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleCatalogModelAlias"
ADD CONSTRAINT "VehicleCatalogModelAlias_modelId_fkey"
FOREIGN KEY ("modelId") REFERENCES "VehicleCatalogModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleCatalogGenerationAlias"
ADD CONSTRAINT "VehicleCatalogGenerationAlias_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "VehicleCatalogGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleCatalogVariantAlias"
ADD CONSTRAINT "VehicleCatalogVariantAlias_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
