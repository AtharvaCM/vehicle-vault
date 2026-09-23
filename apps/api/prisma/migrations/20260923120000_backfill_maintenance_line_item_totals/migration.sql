-- Backfill maintenance line item totals that were entered as quantity x unit
-- price but never saved: the record's own total already counted the derived
-- amount, but the item's own lineTotal stayed null and rendered as ₹0.
--
-- Only touches rows where lineTotal is unset and both quantity and unitPrice
-- are present, so a row where the amount is genuinely unknown is left null.
UPDATE "MaintenanceLineItem"
SET "lineTotal" = ROUND("quantity" * "unitPrice", 2)
WHERE "lineTotal" IS NULL
  AND "quantity" IS NOT NULL
  AND "unitPrice" IS NOT NULL;
