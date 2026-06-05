-- Shared vehicle access: VehicleMember join table + role enum.
-- Existing Vehicle.userId stays as the canonical owner pointer.
-- Every existing vehicle is backfilled with an owner VehicleMember row.

CREATE TYPE "VehicleRole" AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE "VehicleMember" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId" UUID NOT NULL,
  "userId"    UUID NOT NULL,
  "role"      "VehicleRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleMember_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VehicleMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VehicleMember_vehicleId_userId_key"
  ON "VehicleMember" ("vehicleId", "userId");
CREATE INDEX "VehicleMember_userId_idx" ON "VehicleMember" ("userId");
CREATE INDEX "VehicleMember_vehicleId_idx" ON "VehicleMember" ("vehicleId");

-- Backfill owner row for every existing vehicle.
INSERT INTO "VehicleMember" ("vehicleId", "userId", "role")
SELECT "id", "userId", 'owner'::"VehicleRole"
FROM "Vehicle";
