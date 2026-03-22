-- CreateEnum
CREATE TYPE "CatalogImportRunStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "VehicleCatalogGeneration" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "sourceName" VARCHAR(80),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogVariantOffering" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "fuelTypes" "FuelType"[],
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "sourceName" VARCHAR(80),
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCatalogVariantOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogImportRun" (
    "id" UUID NOT NULL,
    "sourceKey" VARCHAR(80) NOT NULL,
    "marketCode" VARCHAR(2) NOT NULL,
    "status" "CatalogImportRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,
    "recordsArchived" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "VehicleCatalogImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCatalogImportSnapshot" (
    "id" UUID NOT NULL,
    "importRunId" UUID NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCatalogImportSnapshot_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VehicleCatalogVariant" ADD COLUMN "generationId" UUID;

-- Migrate existing flat variants into a default generation per model
INSERT INTO "VehicleCatalogGeneration" (
    "id",
    "modelId",
    "name",
    "slug",
    "yearStart",
    "yearEnd",
    "isCurrent",
    "sourceName",
    "sourceUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    m."id",
    m."name",
    CONCAT(m."slug", '-default-generation'),
    NULL,
    NULL,
    true,
    COALESCE(m."sourceName", 'catalog_migration'),
    m."sourceUrl",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "VehicleCatalogModel" m
WHERE EXISTS (
    SELECT 1
    FROM "VehicleCatalogVariant" v
    WHERE v."modelId" = m."id"
)
AND NOT EXISTS (
    SELECT 1
    FROM "VehicleCatalogGeneration" g
    WHERE g."modelId" = m."id"
);

UPDATE "VehicleCatalogVariant" v
SET "generationId" = g."id"
FROM "VehicleCatalogGeneration" g
WHERE g."modelId" = v."modelId"
  AND v."generationId" IS NULL;

INSERT INTO "VehicleCatalogVariantOffering" (
    "id",
    "variantId",
    "fuelTypes",
    "yearStart",
    "yearEnd",
    "isCurrent",
    "sourceName",
    "sourceUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    v."id",
    v."fuelTypes",
    v."yearStart",
    v."yearEnd",
    v."isCurrent",
    v."sourceName",
    v."sourceUrl",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "VehicleCatalogVariant" v
WHERE NOT EXISTS (
    SELECT 1
    FROM "VehicleCatalogVariantOffering" o
    WHERE o."variantId" = v."id"
);

ALTER TABLE "VehicleCatalogVariant"
ALTER COLUMN "generationId" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "VehicleCatalogVariant_modelId_name_idx";

-- DropIndex
DROP INDEX IF EXISTS "VehicleCatalogVariant_modelId_yearStart_yearEnd_idx";

-- DropForeignKey
ALTER TABLE "VehicleCatalogVariant" DROP CONSTRAINT IF EXISTS "VehicleCatalogVariant_modelId_fkey";

-- AlterTable
ALTER TABLE "VehicleCatalogVariant"
DROP COLUMN "modelId",
DROP COLUMN "fuelTypes",
DROP COLUMN "yearStart",
DROP COLUMN "yearEnd",
DROP COLUMN "isCurrent";

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogGeneration_modelId_slug_key" ON "VehicleCatalogGeneration"("modelId", "slug");

-- CreateIndex
CREATE INDEX "VehicleCatalogGeneration_modelId_name_idx" ON "VehicleCatalogGeneration"("modelId", "name");

-- CreateIndex
CREATE INDEX "VehicleCatalogGeneration_modelId_yearStart_yearEnd_idx" ON "VehicleCatalogGeneration"("modelId", "yearStart", "yearEnd");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCatalogVariant_generationId_slug_key" ON "VehicleCatalogVariant"("generationId", "slug");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariant_generationId_name_idx" ON "VehicleCatalogVariant"("generationId", "name");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariantOffering_variantId_yearStart_yearEnd_idx" ON "VehicleCatalogVariantOffering"("variantId", "yearStart", "yearEnd");

-- CreateIndex
CREATE INDEX "VehicleCatalogVariantOffering_variantId_isCurrent_idx" ON "VehicleCatalogVariantOffering"("variantId", "isCurrent");

-- CreateIndex
CREATE INDEX "VehicleCatalogImportRun_marketCode_sourceKey_startedAt_idx" ON "VehicleCatalogImportRun"("marketCode", "sourceKey", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "VehicleCatalogImportSnapshot_importRunId_capturedAt_idx" ON "VehicleCatalogImportSnapshot"("importRunId", "capturedAt" DESC);

-- AddForeignKey
ALTER TABLE "VehicleCatalogGeneration" ADD CONSTRAINT "VehicleCatalogGeneration_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleCatalogModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCatalogVariant" ADD CONSTRAINT "VehicleCatalogVariant_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleCatalogGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCatalogVariantOffering" ADD CONSTRAINT "VehicleCatalogVariantOffering_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCatalogImportSnapshot" ADD CONSTRAINT "VehicleCatalogImportSnapshot_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "VehicleCatalogImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
