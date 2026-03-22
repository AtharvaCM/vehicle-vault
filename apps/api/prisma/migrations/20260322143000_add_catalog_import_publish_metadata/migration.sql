-- AlterTable
ALTER TABLE "VehicleCatalogImportRun"
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedByUserId" UUID;

-- CreateIndex
CREATE INDEX "VehicleCatalogImportRun_marketCode_sourceKey_publishedAt_idx"
ON "VehicleCatalogImportRun"("marketCode", "sourceKey", "publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "VehicleCatalogImportRun"
ADD CONSTRAINT "VehicleCatalogImportRun_publishedByUserId_fkey"
FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
