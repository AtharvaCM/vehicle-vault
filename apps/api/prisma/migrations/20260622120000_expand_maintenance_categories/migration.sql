-- Expand MaintenanceCategory enum so body, lighting, fastener, detailing,
-- electrical, and brake-service line items can be classified instead of
-- collapsing into "other". ALTER TYPE ADD VALUE must run before any DML
-- references the new values, so this migration only mutates the enum.
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'body_trim';
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'lighting';
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'electrical_repair';
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'fasteners';
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'detailing';
ALTER TYPE "MaintenanceCategory" ADD VALUE IF NOT EXISTS 'brake_service';
