import { AuditResourceType } from '@prisma/client';

/**
 * Per-resource fields that must NEVER appear in AuditEvent payloads.
 *
 * Values are replaced with the sentinel `[redacted]` rather than dropped
 * so the changedFields array still records that the field changed. See
 * ADR-0004.
 */
export const REDACTED_FIELDS: Record<AuditResourceType, ReadonlySet<string>> = {
  [AuditResourceType.user]: new Set([
    'passwordHash',
    'passwordResetTokenHash',
    'passwordResetTokenExpiresAt',
    'refreshTokenHash',
    'emailVerificationTokenHash',
    'emailVerificationTokenExpiresAt',
  ]),
  [AuditResourceType.oauth_account]: new Set(['providerAccountId']),
  [AuditResourceType.vehicle]: new Set(),
  [AuditResourceType.maintenance_record]: new Set(),
  [AuditResourceType.reminder]: new Set(),
  [AuditResourceType.insurance_policy]: new Set(['policyNumber']),
  [AuditResourceType.warranty]: new Set(['warrantyNumber']),
  [AuditResourceType.claim]: new Set(['claimNumber']),
  [AuditResourceType.fuel_log]: new Set(),
  [AuditResourceType.attachment]: new Set(['fileName']),
  [AuditResourceType.vehicle_loan]: new Set(['accountNumber']),
  [AuditResourceType.loan_prepayment]: new Set(),
  [AuditResourceType.vehicle_member]: new Set(),
  [AuditResourceType.vehicle_invite]: new Set(['tokenHash']),
};

const REDACTED_SENTINEL = '[redacted]';

export function redact(
  resourceType: AuditResourceType | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!payload) return null;
  if (!resourceType) return cloneSerializable(payload);

  const denyList = REDACTED_FIELDS[resourceType];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (denyList.has(key)) {
      out[key] = REDACTED_SENTINEL;
    } else {
      out[key] = serializeValue(value);
    }
  }
  return out;
}

function cloneSerializable(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = serializeValue(value);
  }
  return out;
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  // Prisma.Decimal exposes toFixed/toString — convert to string for safe JSON storage.
  if (typeof value === 'object' && value !== null && 'toFixed' in value && typeof (value as { toFixed: unknown }).toFixed === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return value;
}

/**
 * Computes the set of changed top-level fields between `before` and `after`.
 * Uses deep-equality via JSON serialisation — sufficient for the flat
 * Prisma row shapes we store.
 */
export function diffChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before && !after) return [];
  if (!before) return Object.keys(after ?? {});
  if (!after) return Object.keys(before);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}
