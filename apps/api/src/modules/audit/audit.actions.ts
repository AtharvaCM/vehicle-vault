/**
 * Canonical dotted-string vocabulary for AuditEvent.action. See ADR-0004.
 *
 * Convention: `{namespace}.{verb}` where namespace is the resource family
 * (vehicle, maintenance, reminder, document, claim, fuel, auth) and verb
 * is past tense (created, updated, deleted, restored). Auth events use
 * the `auth.` prefix and don't carry a resource reference.
 */
export const AUDIT_ACTIONS = {
  vehicle: {
    created: 'vehicle.created',
    updated: 'vehicle.updated',
    deleted: 'vehicle.deleted',
  },
  maintenance: {
    created: 'maintenance.created',
    updated: 'maintenance.updated',
    deleted: 'maintenance.deleted',
  },
  reminder: {
    created: 'reminder.created',
    updated: 'reminder.updated',
    completed: 'reminder.completed',
    deleted: 'reminder.deleted',
  },
  insurance: {
    created: 'insurance.created',
    updated: 'insurance.updated',
    deleted: 'insurance.deleted',
  },
  warranty: {
    created: 'warranty.created',
    updated: 'warranty.updated',
    deleted: 'warranty.deleted',
  },
  claim: {
    created: 'claim.created',
    updated: 'claim.updated',
    deleted: 'claim.deleted',
  },
  fuel: {
    created: 'fuel.created',
    updated: 'fuel.updated',
    deleted: 'fuel.deleted',
  },
  loan: {
    created: 'loan.created',
    updated: 'loan.updated',
    deleted: 'loan.deleted',
    closed: 'loan.closed',
    foreclosed: 'loan.foreclosed',
    prepaymentAdded: 'loan.prepayment_added',
    prepaymentDeleted: 'loan.prepayment_deleted',
  },
  attachment: {
    uploaded: 'attachment.uploaded',
    deleted: 'attachment.deleted',
  },
  auth: {
    accountCreated: 'auth.account_created',
    loginSucceeded: 'auth.login_succeeded',
    loginFailed: 'auth.login_failed',
    loggedOut: 'auth.logged_out',
    refreshRotated: 'auth.refresh_rotated',
    passwordResetRequested: 'auth.password_reset_requested',
    passwordResetCompleted: 'auth.password_reset_completed',
    emailVerified: 'auth.email_verified',
    oauthLinked: 'auth.oauth_linked',
  },
  admin: {
    forceLogout: 'admin.force_logout',
  },
} as const;

export type AuditAction = string;
