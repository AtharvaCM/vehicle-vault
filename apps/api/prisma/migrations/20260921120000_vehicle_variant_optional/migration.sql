-- Variant becomes optional on a vehicle.
--
-- Naming the exact trim is the longest step in adding a vehicle and the one
-- most often answered wrongly, while almost nothing depends on the free-text
-- value: service intervals and specs are resolved through the catalog link
-- (`catalogVariantId`, or the generation when the variant is ambiguous), which
-- has never read this column. Existing rows keep whatever they hold.

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "variant" DROP NOT NULL;
