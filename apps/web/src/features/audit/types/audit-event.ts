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
  | 'attachment';

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
};

export type AuditListResponse = {
  events: AuditEvent[];
  nextCursor: string | null;
};

export type AuditQueryFilters = {
  resourceType?: AuditResourceType;
  action?: string;
  actionPrefix?: string;
  from?: string;
  to?: string;
  limit?: number;
};
