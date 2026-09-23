-- A reminder's origin and repeat rule become columns. Until now, a reminder
-- made from the suggested service schedule remembered its catalog item through
-- a `[catalog:<slug>]` marker appended to `notes`, which the web printed and
-- let people delete (turning recurrence off), and nothing else could repeat.

ALTER TABLE "Reminder"
  ADD COLUMN "catalogSlug" VARCHAR(64),
  ADD COLUMN "repeatEveryMonths" INTEGER,
  ADD COLUMN "repeatEveryKm" INTEGER;

ALTER TABLE "Reminder"
  ADD CONSTRAINT "Reminder_repeatEveryMonths_positive" CHECK ("repeatEveryMonths" IS NULL OR "repeatEveryMonths" > 0),
  ADD CONSTRAINT "Reminder_repeatEveryKm_positive" CHECK ("repeatEveryKm" IS NULL OR "repeatEveryKm" > 0);

-- The first marker is the slug, as `extractSlugFromNotes` read it.
UPDATE "Reminder"
SET "catalogSlug" = left(substring("notes" FROM '\[catalog:([^\]]+)\]'), 64)
WHERE "notes" ~ '\[catalog:[^\]]+\]';

-- Every marker leaves the notes, with the line break before it; notes that
-- held nothing else become null.
UPDATE "Reminder"
SET "notes" = NULLIF(
  regexp_replace(regexp_replace("notes", '\s*\[catalog:[^\]]*\]', '', 'g'), '^\s+|\s+$', '', 'g'),
  ''
)
WHERE "notes" ~ '\[catalog:[^\]]*\]';

-- The repeat rule a schedule reminder was already following: the schedule
-- item's interval (service-schedule-catalog.ts as of this migration), with
-- the vehicle's catalog variant's interval for that category in its place
-- where one is set, as `ServiceScheduleService` resolved it on completion.
WITH "catalog" ("slug", "category", "km", "months") AS (
  VALUES
    ('engine_oil_change', 'engine_oil'::"MaintenanceCategory", 10000, 12),
    ('tyre_rotation', 'tyre_rotation'::"MaintenanceCategory", 10000, NULL),
    ('tyre_inspection', NULL, 5000, 6),
    ('brake_inspection', 'brake_pads'::"MaintenanceCategory", 20000, 24),
    ('coolant_flush', 'coolant'::"MaintenanceCategory", 40000, 24),
    ('air_filter', 'air_filter'::"MaintenanceCategory", 20000, 24),
    ('battery_check', NULL, NULL, 24),
    ('ev_battery_health', NULL, NULL, 12),
    ('puc_renewal', NULL, NULL, 6),
    ('insurance_renewal', NULL, NULL, 12),
    ('chain_lube', 'chain_service'::"MaintenanceCategory", 500, NULL)
),
"rule" AS (
  SELECT
    r."id",
    COALESCE(si."intervalKm", c."km") AS "km",
    COALESCE(si."intervalMonths", c."months") AS "months"
  FROM "Reminder" r
  JOIN "catalog" c ON c."slug" = r."catalogSlug"
  JOIN "Vehicle" v ON v."id" = r."vehicleId"
  LEFT JOIN "ServiceInterval" si
    ON si."variantId" = v."catalogVariantId"
   AND si."category" = c."category"
)
UPDATE "Reminder" r
SET "repeatEveryKm" = "rule"."km", "repeatEveryMonths" = "rule"."months"
FROM "rule"
WHERE r."id" = "rule"."id";
