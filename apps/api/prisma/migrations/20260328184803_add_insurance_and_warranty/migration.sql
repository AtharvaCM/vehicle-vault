-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "policyNumber" VARCHAR(80) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "premiumAmount" DECIMAL(12,2),
    "insuredValue" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "warrantyNumber" VARCHAR(80),
    "type" VARCHAR(60) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "endOdometer" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsurancePolicy_vehicleId_endDate_idx" ON "InsurancePolicy"("vehicleId", "endDate");

-- CreateIndex
CREATE INDEX "Warranty_vehicleId_idx" ON "Warranty"("vehicleId");

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
