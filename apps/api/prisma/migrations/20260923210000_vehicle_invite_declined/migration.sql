-- An invitee can now decline an invite; like accepting or revoking, it ends it.
ALTER TABLE "VehicleInvite" ADD COLUMN "declinedAt" TIMESTAMP(3);
