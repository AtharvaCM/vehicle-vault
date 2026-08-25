-- A duplicated (variantId, category) row made the resolved interval depend on
-- findMany ordering, so the same vehicle could report different "due"
-- thresholds between requests. Collapse existing duplicates before enforcing
-- uniqueness, keeping the most recently updated row for each pair.
DELETE FROM "ServiceInterval" a
USING "ServiceInterval" b
WHERE a."variantId" = b."variantId"
  AND a."category" = b."category"
  AND (a."updatedAt", a."id") < (b."updatedAt", b."id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInterval_variantId_category_key" ON "ServiceInterval"("variantId", "category");
