-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg', 'other');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('car', 'motorcycle', 'suv', 'truck', 'van', 'other');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('periodic_service', 'engine_oil', 'oil_filter', 'air_filter', 'brake_pads', 'tyre_rotation', 'wheel_alignment', 'battery', 'coolant', 'clutch', 'chain_service', 'tyre_replacement', 'puncture', 'insurance', 'puc', 'other');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('service', 'insurance', 'puc', 'tyre_rotation', 'battery', 'custom');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('upcoming', 'due_today', 'overdue', 'completed');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('receipt', 'document', 'image', 'other');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "registrationNumber" VARCHAR(20) NOT NULL,
    "make" VARCHAR(80) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "variant" VARCHAR(80) NOT NULL,
    "year" INTEGER NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "odometer" INTEGER NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "nickname" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "workshopName" VARCHAR(120),
    "totalCost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "nextDueOdometer" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "type" "ReminderType" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueOdometer" INTEGER,
    "status" "ReminderStatus" NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "maintenanceRecordId" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_createdAt_idx" ON "Vehicle"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_serviceDate_idx" ON "MaintenanceRecord"("vehicleId", "serviceDate" DESC);

-- CreateIndex
CREATE INDEX "Reminder_vehicleId_createdAt_idx" ON "Reminder"("vehicleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Reminder_status_dueDate_idx" ON "Reminder"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Attachment_maintenanceRecordId_uploadedAt_idx" ON "Attachment"("maintenanceRecordId", "uploadedAt" DESC);

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "MaintenanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

