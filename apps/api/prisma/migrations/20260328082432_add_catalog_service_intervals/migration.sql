-- CreateTable
CREATE TABLE "ServiceInterval" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "intervalKm" INTEGER,
    "intervalMonths" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceInterval_variantId_idx" ON "ServiceInterval"("variantId");

-- AddForeignKey
ALTER TABLE "ServiceInterval" ADD CONSTRAINT "ServiceInterval_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "VehicleCatalogVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
