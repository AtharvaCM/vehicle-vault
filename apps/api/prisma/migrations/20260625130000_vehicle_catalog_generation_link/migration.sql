-- Add optional generation-level catalog link to Vehicle. Lets the auto-linker
-- record a partial match (Hyundai Creta (2024 facelift)) when multiple
-- variants are still in the running, so the UI can show the resolved
-- model/generation and prompt the user to pick a variant.

ALTER TABLE "Vehicle"
    ADD COLUMN "catalogGenerationId" UUID;

ALTER TABLE "Vehicle"
    ADD CONSTRAINT "Vehicle_catalogGenerationId_fkey"
    FOREIGN KEY ("catalogGenerationId")
    REFERENCES "VehicleCatalogGeneration"("id")
    ON DELETE SET NULL;

CREATE INDEX "Vehicle_catalogGenerationId_idx" ON "Vehicle"("catalogGenerationId");
