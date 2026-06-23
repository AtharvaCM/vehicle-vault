-- MaintenancePartCatalog: global, append-only lookup harvested from line items.
-- Future ingestions (manual form, OCR extraction) query by name + partNumber to
-- pre-fill normalizedCategory, shrinking the share of items that land in "other".
CREATE TABLE "MaintenancePartCatalog" (
    "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "nameNormalized"    VARCHAR(160) NOT NULL,
    "partNumber"        VARCHAR(80),
    "displayName"       VARCHAR(160) NOT NULL,
    "brand"             VARCHAR(80),
    "suggestedCategory" "MaintenanceCategory" NOT NULL,
    "occurrences"       INTEGER NOT NULL DEFAULT 1,
    "lastSeenAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Matches @@unique([nameNormalized, partNumber]) in schema.prisma. Postgres
-- treats NULL as distinct here, so the upsert path in MaintenancePartCatalogService
-- explicitly looks up rows with partNumber IS NULL before inserting to avoid dupes.
CREATE UNIQUE INDEX "MaintenancePartCatalog_nameNormalized_partNumber_key"
    ON "MaintenancePartCatalog" ("nameNormalized", "partNumber");
CREATE INDEX "MaintenancePartCatalog_suggestedCategory_idx"
    ON "MaintenancePartCatalog" ("suggestedCategory");
CREATE INDEX "MaintenancePartCatalog_nameNormalized_idx"
    ON "MaintenancePartCatalog" ("nameNormalized");

-- Backfill #1: reclassify existing "other" line items whose names clearly fit
-- one of the new categories. Patterns are intentionally conservative — only
-- substring matches strong enough to avoid false moves.
UPDATE "MaintenanceLineItem"
SET    "normalizedCategory" = 'brake_service'
WHERE  "normalizedCategory" = 'other'
  AND  "name" ILIKE '%caliper%';

UPDATE "MaintenanceLineItem"
SET    "normalizedCategory" = 'lighting'
WHERE  "normalizedCategory" = 'other'
  AND  ("name" ILIKE '%headlight%'
        OR "name" ILIKE '%tail lamp%'
        OR "name" ILIKE '%headlamp%'
        OR "name" ILIKE '%indicator%');

UPDATE "MaintenanceLineItem"
SET    "normalizedCategory" = 'fasteners'
WHERE  "normalizedCategory" = 'other'
  AND  ("name" ILIKE '%rivet%'
        OR "name" ILIKE '%clip%'
        OR "name" ILIKE '%bolt%'
        OR "name" ILIKE '%cone seat%');

UPDATE "MaintenanceLineItem"
SET    "normalizedCategory" = 'detailing'
WHERE  "normalizedCategory" = 'other'
  AND  ("name" ILIKE '%washing%'
        OR "name" ILIKE '%polish%'
        OR "name" ILIKE '%detailing%'
        OR "name" ILIKE '%cleaning%');

UPDATE "MaintenanceLineItem"
SET    "normalizedCategory" = 'body_trim'
WHERE  "normalizedCategory" = 'other'
  AND  ("name" ILIKE '%grill%'
        OR "name" ILIKE '%molding%'
        OR "name" ILIKE '%moulding%'
        OR "name" ILIKE '%spoiler%'
        OR "name" ILIKE '%bumper%'
        OR "name" ILIKE '%fender%'
        OR "name" ILIKE '%primer%'
        OR "name" ILIKE '%gloss%'
        OR "name" ILIKE '%cover%'
        OR "name" ILIKE '%cap%');

-- Backfill #2: seed MaintenancePartCatalog from every part-kind line item.
-- Per (lower(name), partNumber): pick the most-frequent concrete category as
-- the suggestion; ignore rows tagged "other"/NULL when scoring (they carry no
-- signal). Skip groups with no confident category.
WITH norm AS (
    SELECT
        lower(trim("name")) AS name_norm,
        "name"              AS raw_name,
        "partNumber",
        brand,
        "normalizedCategory" AS cat,
        "createdAt"
    FROM "MaintenanceLineItem"
    WHERE "kind" = 'part'
      AND "name" IS NOT NULL
      AND length(trim("name")) > 0
),
cat_counts AS (
    SELECT name_norm, "partNumber", cat, COUNT(*) AS c
    FROM   norm
    WHERE  cat IS NOT NULL AND cat <> 'other'
    GROUP BY name_norm, "partNumber", cat
),
best_cat AS (
    SELECT DISTINCT ON (name_norm, "partNumber")
        name_norm, "partNumber", cat
    FROM   cat_counts
    ORDER BY name_norm, "partNumber", c DESC
),
display AS (
    SELECT DISTINCT ON (name_norm, "partNumber")
        name_norm, "partNumber", raw_name, brand
    FROM   norm
    ORDER BY name_norm, "partNumber", "createdAt" DESC
),
agg AS (
    SELECT name_norm, "partNumber", COUNT(*)::int AS occ, MAX("createdAt") AS last_seen
    FROM   norm
    GROUP BY name_norm, "partNumber"
)
INSERT INTO "MaintenancePartCatalog" (
    "nameNormalized", "partNumber", "displayName", "brand",
    "suggestedCategory", "occurrences", "lastSeenAt"
)
SELECT
    bc.name_norm,
    bc."partNumber",
    d.raw_name,
    d.brand,
    bc.cat,
    a.occ,
    a.last_seen
FROM   best_cat bc
JOIN   display d
       ON d.name_norm = bc.name_norm
       AND d."partNumber" IS NOT DISTINCT FROM bc."partNumber"
JOIN   agg a
       ON a.name_norm = bc.name_norm
       AND a."partNumber" IS NOT DISTINCT FROM bc."partNumber"
ON CONFLICT DO NOTHING;
