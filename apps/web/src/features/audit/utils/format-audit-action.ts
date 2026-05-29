import type { AuditResourceType } from '../types/audit-event';

export type AuditActionTone = 'accent' | 'neutral' | 'warning' | 'danger';

const NAMESPACE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  maintenance: 'Maintenance',
  reminder: 'Reminder',
  insurance: 'Insurance',
  warranty: 'Warranty',
  claim: 'Claim',
  fuel: 'Fuel log',
  attachment: 'Attachment',
  auth: 'Account',
};

const VERB_LABELS: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  restored: 'restored',
  completed: 'completed',
  uploaded: 'uploaded',
  account_created: 'created',
  login_succeeded: 'signed in',
  login_failed: 'sign-in failed',
  logged_out: 'signed out',
  refresh_rotated: 'session refreshed',
  password_reset_requested: 'password reset requested',
  password_reset_completed: 'password reset completed',
  email_verified: 'email verified',
  oauth_linked: 'linked a sign-in provider',
};

const RESOURCE_TYPE_LABELS: Record<AuditResourceType, string> = {
  vehicle: 'Vehicle',
  maintenance_record: 'Maintenance record',
  reminder: 'Reminder',
  insurance_policy: 'Insurance policy',
  warranty: 'Warranty',
  claim: 'Claim',
  fuel_log: 'Fuel log',
  user: 'Account',
  oauth_account: 'Sign-in provider',
  attachment: 'Attachment',
};

function toneForVerb(verb: string): AuditActionTone {
  if (verb === 'deleted' || verb === 'login_failed') return 'danger';
  if (verb === 'created' || verb === 'account_created' || verb === 'completed' || verb === 'uploaded') {
    return 'accent';
  }
  if (
    verb === 'login_failed' ||
    verb === 'password_reset_requested' ||
    verb === 'refresh_rotated'
  ) {
    return 'warning';
  }
  return 'neutral';
}

function humanise(token: string): string {
  return token.replace(/_/g, ' ');
}

export function formatAuditAction(action: string): { label: string; tone: AuditActionTone } {
  const [namespace, ...rest] = action.split('.');
  const verb = rest.join('.');
  const namespaceLabel = NAMESPACE_LABELS[namespace ?? ''] ?? humanise(namespace ?? action);
  const verbLabel = VERB_LABELS[verb] ?? humanise(verb);

  return {
    label: verb ? `${namespaceLabel} ${verbLabel}` : namespaceLabel,
    tone: toneForVerb(verb),
  };
}

export function formatResourceType(resourceType: AuditResourceType | null): string | null {
  return resourceType ? RESOURCE_TYPE_LABELS[resourceType] : null;
}
