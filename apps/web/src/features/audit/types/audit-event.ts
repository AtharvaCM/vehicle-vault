export type AuditResourceType =
  | 'vehicle'
  | 'maintenance_record'
  | 'reminder'
  | 'insurance_policy'
  | 'warranty'
  | 'claim'
  | 'fuel_log'
  | 'user'
  | 'oauth_account'
  | 'attachment'
  | 'vehicle_loan'
  | 'loan_prepayment'
  | 'vehicle_member'
  | 'vehicle_invite'
  | 'compliance_document'
  | 'tyre'
  | 'accessory'
  | 'service_baseline';

/** Settings → Activity's two views. */
export type AuditCategory = 'security' | 'garage';

export type AuditEvent = {
  id: string;
  occurredAt: string;
  action: string;
  actorUserId: string | null;
  ownerUserId: string | null;
  resourceType: AuditResourceType | null;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  /** Who did it: "You", or their name. Null when nobody did (the system). */
  actor?: { name: string; isYou: boolean } | null;
  /** Whether the record still exists to open; null when there is nothing to open. */
  resourceExists?: boolean | null;
};

export type AuditListResponse = {
  events: AuditEvent[];
  nextCursor: string | null;
};

export type AuditQueryFilters = {
  resourceType?: AuditResourceType;
  action?: string;
  actionPrefix?: string;
  category?: AuditCategory;
  from?: string;
  to?: string;
  limit?: number;
};
