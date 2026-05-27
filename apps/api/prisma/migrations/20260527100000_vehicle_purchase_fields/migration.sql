-- Add purchase metadata to Vehicle for TCO and ownership-trend analytics.
-- All fields nullable so existing vehicles backfill on next edit.

ALTER TABLE "Vehicle"
  ADD COLUMN "purchaseDate" TIMESTAMP(3),
  ADD COLUMN "purchasePrice" DECIMAL(12, 2),
  ADD COLUMN "purchaseOdometer" INTEGER;
