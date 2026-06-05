-- Add audit resource type values for the invite flow.
-- Postgres requires ALTER TYPE ... ADD VALUE to be committed before the new value is used.
ALTER TYPE "AuditResourceType" ADD VALUE IF NOT EXISTS 'vehicle_member';
ALTER TYPE "AuditResourceType" ADD VALUE IF NOT EXISTS 'vehicle_invite';
