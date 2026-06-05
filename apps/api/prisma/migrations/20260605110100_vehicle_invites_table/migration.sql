-- Vehicle invite tokens (M12b).

CREATE TABLE "VehicleInvite" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId"       UUID NOT NULL,
  "email"           VARCHAR(255) NOT NULL,
  "role"            "VehicleRole" NOT NULL,
  "tokenHash"       CHAR(64) NOT NULL,
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  "acceptedAt"      TIMESTAMP(3),
  "revokedAt"       TIMESTAMP(3),
  "invitedByUserId" UUID NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleInvite_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VehicleInvite_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VehicleInvite_tokenHash_key" ON "VehicleInvite" ("tokenHash");
CREATE INDEX "VehicleInvite_vehicleId_idx" ON "VehicleInvite" ("vehicleId");
CREATE INDEX "VehicleInvite_email_vehicleId_idx" ON "VehicleInvite" ("email", "vehicleId");
