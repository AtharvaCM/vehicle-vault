import type { AuditActionName } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

import type { AuditEvent } from '../types/audit-event';

/** Where a sentence can open, as the router names it. */
export type ActivityLink =
  | { to: '/vehicles/$vehicleId'; params: { vehicleId: string }; search?: Record<string, string> }
  | { to: '/maintenance-records/$recordId'; params: { recordId: string } }
  | { to: '/reminders/$reminderId'; params: { reminderId: string } }
  | { to: '/costs/loans/$loanId'; params: { loanId: string } };

export type ActivitySentence = {
  /** Actor first: "Priya logged a fuel fill". */
  text: string;
  /** The figures that make it this one: "28 L · ₹2,996 · 18,500 km". */
  detail: string | null;
  /** The record, while it still exists. */
  link: ActivityLink | null;
  /** Worth a "Not you?" beside it. */
  suspicious: boolean;
};

type Payload = Record<string, unknown>;

type Context = {
  event: AuditEvent;
  /** The row after the change, or before it for a deletion. */
  row: Payload;
  actor: string;
  /** "Your" / "Priya's". */
  possessive: string;
};

type Describer = (context: Context) => Omit<ActivitySentence, 'link' | 'suspicious'> & {
  suspicious?: boolean;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};
const money = (value: unknown) => {
  const n = num(value);
  return n != null && n > 0 ? format.money(n) : null;
};
const km = (value: unknown) => {
  const n = num(value);
  return n != null && n > 0 ? format.odometer(n) : null;
};
const day = (value: unknown) => (text(value) ? format.date(value as string) : null);
const join = (...parts: Array<string | null | undefined>) =>
  parts.filter((part): part is string => Boolean(part)).join(' · ') || null;
const quoted = (value: unknown) => (text(value) ? `“${text(value)}”` : null);

/** "23 Feb 2027 → 23 Aug 2027": one field's change, when both sides can be read. */
function change(context: Context, field: string, read: (value: unknown) => string | null) {
  const before = read(context.event.before?.[field]);
  const after = read(context.event.after?.[field]);
  if (!after && !before) return null;
  return before && after && before !== after ? `${before} → ${after}` : (after ?? before);
}

/** The fields an edit touched, in words, leaving out bookkeeping. */
const FIELD_WORDS: Record<string, string> = {
  nickname: 'name',
  registrationNumber: 'number plate',
  odometer: 'odometer',
  variant: 'variant',
  purchaseDate: 'purchase date',
  purchasePrice: 'purchase price',
  purchaseOdometer: 'purchase reading',
  serviceDate: 'date',
  workshopName: 'workshop',
  totalCost: 'cost',
  category: 'kind',
  notes: 'notes',
  title: 'title',
  dueDate: 'due date',
  dueOdometer: 'due reading',
  endDate: 'expiry',
  startDate: 'start date',
  provider: 'provider',
  number: 'number',
  quantity: 'litres',
  price: 'price',
  location: 'station',
  date: 'date',
  brand: 'brand',
  model: 'model',
  size: 'size',
  name: 'name',
  cost: 'cost',
  lender: 'lender',
  principal: 'amount',
  interestRate: 'rate',
  tenureMonths: 'term',
  status: 'status',
};
const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt', 'vehicle', 'id', 'vehicleId']);

function changedWords(context: Context) {
  const words = context.event.changedFields
    .filter((field) => !IGNORED_FIELDS.has(field))
    .map((field) => FIELD_WORDS[field])
    .filter((word): word is string => Boolean(word));
  return [...new Set(words)].join(', ') || null;
}

function vehicleName(row: Payload) {
  return (
    text(row.nickname) ??
    ([text(row.make), text(row.model)].filter(Boolean).join(' ') || 'a vehicle')
  );
}

const DOCUMENT_WORDS: Record<string, string> = {
  insurance: 'insurance',
  warranty: 'warranty',
  registration: 'RC',
  puc: 'PUC',
  road_tax: 'road tax',
};

function documentDescribers(namespace: string): Record<string, Describer> {
  const name = DOCUMENT_WORDS[namespace]!;
  return {
    created: ({ actor, row }) => ({
      text: `${actor} added the ${name}`,
      detail: join(text(row.provider), day(row.endDate) ? `ends ${day(row.endDate)}` : null),
    }),
    updated: (context) => {
      const expiry = context.event.changedFields.includes('endDate')
        ? change(context, 'endDate', day)
        : null;
      return expiry
        ? { text: `${context.actor} changed the ${name} expiry`, detail: expiry }
        : { text: `${context.actor} changed the ${name}`, detail: changedWords(context) };
    },
    deleted: ({ actor, row }) => ({
      text: `${actor} deleted the ${name}`,
      detail: join(text(row.provider)),
    }),
  };
}

const serviceName = (row: Payload) =>
  text(row.category)
    ? format.enumLabel('maintenanceCategory', row.category as never).toLowerCase()
    : 'a service';
const tyreName = (row: Payload) =>
  text(row.position)
    ? `${format.enumLabel('tyrePosition', row.position as never).toLowerCase()} tyre`
    : 'a tyre';
const fill = (row: Payload) =>
  join(
    num(row.quantity) != null ? `${format.number(num(row.quantity)!, { decimals: 2 })} L` : null,
    money(row.totalCost),
    km(row.odometer),
  );

const LOGIN_FAILURES: Record<string, string> = {
  bad_password: 'wrong password',
  no_credential: 'this account has no password',
  rate_limited: 'too many attempts',
};

const PROVIDER_WORDS: Record<string, string> = { google: 'Google', github: 'GitHub' };

/**
 * Every action the API records, in words, actor first. Keyed by the shared
 * vocabulary, so the compiler and `describe-audit-event.spec.ts` both catch
 * an action with no sentence.
 */
const DESCRIBERS: Record<AuditActionName, Describer> = {
  'vehicle.created': ({ actor, row }) => ({
    text: `${actor} added ${vehicleName(row)}`,
    detail: join(
      text(row.registrationNumber) ? format.registration(row.registrationNumber as string) : null,
      km(row.odometer),
    ),
  }),
  'vehicle.updated': (context) =>
    context.event.changedFields.includes('odometer') && context.event.changedFields.length <= 2
      ? {
          text: `${context.actor} updated the odometer of ${vehicleName(context.row)}`,
          detail: change(context, 'odometer', km),
        }
      : {
          text: `${context.actor} changed ${vehicleName(context.row)}`,
          detail: changedWords(context),
        },
  'vehicle.deleted': ({ actor, row }) => ({
    text: `${actor} deleted ${vehicleName(row)}`,
    detail: null,
  }),

  'maintenance.created': ({ actor, row }) => ({
    text:
      row.status === 'draft'
        ? `${actor} saved a draft of ${serviceName(row)}`
        : `${actor} logged ${serviceName(row)}`,
    detail: join(text(row.workshopName), money(row.totalCost), km(row.odometer)),
  }),
  'maintenance.updated': (context) =>
    context.event.before?.status === 'draft' && context.event.after?.status === 'confirmed'
      ? {
          text: `${context.actor} confirmed ${serviceName(context.row)}`,
          detail: join(money(context.row.totalCost), km(context.row.odometer)),
        }
      : {
          text: `${context.actor} edited ${serviceName(context.row)}`,
          detail: changedWords(context),
        },
  'maintenance.deleted': ({ actor, row }) => ({
    text: `${actor} deleted ${serviceName(row)}`,
    detail: join(day(row.serviceDate), money(row.totalCost)),
  }),

  'reminder.created': ({ actor, row }) => ({
    text: `${actor} added the reminder ${quoted(row.title) ?? ''}`.trim(),
    detail: join(day(row.dueDate) ? `due ${day(row.dueDate)}` : null, km(row.dueOdometer)),
  }),
  'reminder.updated': (context) => ({
    text: `${context.actor} changed the reminder ${quoted(context.row.title) ?? ''}`.trim(),
    detail: context.event.changedFields.includes('dueDate')
      ? change(context, 'dueDate', day)
      : changedWords(context),
  }),
  'reminder.completed': ({ actor, row }) => ({
    text: `${actor} marked ${quoted(row.title) ?? 'a reminder'} done`,
    detail: null,
  }),
  'reminder.deleted': ({ actor, row }) => ({
    text: `${actor} deleted the reminder ${quoted(row.title) ?? ''}`.trim(),
    detail: null,
  }),

  ...(Object.fromEntries(
    ['insurance', 'warranty', 'registration', 'puc', 'road_tax'].flatMap((namespace) =>
      Object.entries(documentDescribers(namespace)).map(([verb, describe]) => [
        `${namespace}.${verb}`,
        describe,
      ]),
    ),
  ) as Record<
    `${'insurance' | 'warranty' | 'registration' | 'puc' | 'road_tax'}.${'created' | 'updated' | 'deleted'}`,
    Describer
  >),

  'claim.created': ({ actor, row }) => ({
    text: `${actor} filed a claim`,
    detail: join(money(row.claimAmount), text(row.status)),
  }),
  'claim.updated': (context) => ({
    text: `${context.actor} updated a claim`,
    detail: changedWords(context),
  }),
  'claim.deleted': ({ actor }) => ({ text: `${actor} deleted a claim`, detail: null }),

  'accessory.created': ({ actor, row }) => ({
    text: `${actor} added ${text(row.name) ?? 'an accessory'}`,
    detail: join(text(row.brand), money(row.cost)),
  }),
  'accessory.updated': (context) => ({
    text: `${context.actor} changed ${text(context.row.name) ?? 'an accessory'}`,
    detail: changedWords(context),
  }),
  'accessory.deleted': ({ actor, row }) => ({
    text: `${actor} removed ${text(row.name) ?? 'an accessory'}`,
    detail: null,
  }),

  'service_baseline.created': ({ actor, row }) => ({
    text: `${actor} answered when ${serviceName(row)} was last done`,
    detail:
      row.status === 'unknown'
        ? 'not known'
        : join(km(row.lastDoneOdometer), day(row.lastDoneDate)),
  }),
  'service_baseline.updated': ({ actor, row }) => ({
    text: `${actor} changed when ${serviceName(row)} was last done`,
    detail:
      row.status === 'unknown'
        ? 'not known'
        : join(km(row.lastDoneOdometer), day(row.lastDoneDate)),
  }),

  'fuel.created': ({ actor, row }) => ({ text: `${actor} logged a fuel fill`, detail: fill(row) }),
  'fuel.updated': ({ actor, row }) => ({ text: `${actor} edited a fuel fill`, detail: fill(row) }),
  'fuel.deleted': ({ actor, row }) => ({ text: `${actor} deleted a fuel fill`, detail: fill(row) }),

  'tyre.created': ({ actor, row }) => ({
    text: `${actor} added the ${tyreName(row)}`,
    detail: join(
      [text(row.brand), text(row.model)].filter(Boolean).join(' ') || null,
      text(row.size),
    ),
  }),
  'tyre.updated': (context) => ({
    text: `${context.actor} changed the ${tyreName(context.row)}`,
    detail: changedWords(context),
  }),
  'tyre.deleted': ({ actor, row }) => ({
    text: `${actor} deleted the ${tyreName(row)}`,
    detail: null,
  }),
  'tyre.inspected': ({ actor, row }) => ({
    text: `${actor} measured a tyre`,
    detail: join(
      num(row.treadDepthMm) != null
        ? `${format.number(num(row.treadDepthMm)!, { decimals: 1 })} mm`
        : null,
      num(row.pressurePsi) != null
        ? `${format.number(num(row.pressurePsi)!, { decimals: 0 })} psi`
        : null,
      km(row.odometer),
    ),
  }),

  'loan.created': ({ actor, row }) => ({
    text: `${actor} added a loan${text(row.lender) ? ` from ${text(row.lender)}` : ''}`,
    detail: join(
      money(row.principal),
      num(row.tenureMonths) ? `${num(row.tenureMonths)} months` : null,
    ),
  }),
  'loan.updated': (context) => ({
    text: `${context.actor} changed the ${text(context.row.lender) ?? ''} loan`.replace('  ', ' '),
    detail: changedWords(context),
  }),
  'loan.deleted': ({ actor, row }) => ({
    text: `${actor} deleted the ${text(row.lender) ?? ''} loan`.replace('  ', ' '),
    detail: null,
  }),
  'loan.closed': ({ actor, row }) => ({
    text: `${actor} closed the ${text(row.lender) ?? ''} loan`.replace('  ', ' '),
    detail: null,
  }),
  'loan.foreclosed': ({ actor, row }) => ({
    text: `${actor} paid off the ${text(row.lender) ?? ''} loan early`.replace('  ', ' '),
    detail: day(row.closedAt),
  }),
  'loan.prepayment_added': ({ actor, row }) => ({
    text: `${actor} prepaid ${money(row.amount) ?? 'part of'} a loan`,
    detail: day(row.date),
  }),
  'loan.prepayment_deleted': ({ actor, row }) => ({
    text: `${actor} removed a prepayment${money(row.amount) ? ` of ${money(row.amount)}` : ''}`,
    detail: day(row.date),
  }),

  'attachment.uploaded': ({ actor, row }) => ({
    text: `${actor} attached a file`,
    detail: text(row.originalFileName) ?? text(row.mimeType),
  }),
  'attachment.deleted': ({ actor, row }) => ({
    text: `${actor} removed a file`,
    detail: text(row.originalFileName),
  }),

  'auth.account_created': ({ actor, row }) => ({
    text: `${actor} created the account`,
    detail: PROVIDER_WORDS[String(row.provider)]
      ? `with ${PROVIDER_WORDS[String(row.provider)]}`
      : null,
  }),
  'auth.login_succeeded': ({ actor, row }) => ({
    text: `${actor} signed in${PROVIDER_WORDS[String(row.provider)] ? ` with ${PROVIDER_WORDS[String(row.provider)]}` : ''}`,
    detail: join(text(row.device), text(row.location)),
  }),
  'auth.login_failed': ({ row }) => ({
    // Recorded against the account it targeted, so the "actor" is the account
    // itself: say what happened to it instead.
    text: 'Someone tried to sign in to your account and failed',
    detail: LOGIN_FAILURES[String(row.reason)] ?? null,
    suspicious: true,
  }),
  'auth.logged_out': ({ actor }) => ({ text: `${actor} signed out`, detail: null }),
  'auth.refresh_rotated': ({ possessive }) => ({
    text: `${possessive} session was renewed`,
    detail: null,
  }),
  'auth.password_reset_requested': () => ({
    text: 'A password reset was asked for',
    detail: 'a link went to your email',
    suspicious: true,
  }),
  'auth.password_reset_completed': ({ actor }) => ({
    text: `${actor} reset the password`,
    detail: 'every device was signed out',
  }),
  'auth.password_changed': ({ actor, row }) => ({
    text: row.firstPassword ? `${actor} set a password` : `${actor} changed the password`,
    detail: 'other devices were signed out',
  }),
  'auth.profile_updated': (context) => ({
    text: `${context.actor} changed the account name`,
    detail: change(context, 'name', text),
  }),
  'auth.session_revoked': ({ actor, row }) => ({
    text: row.current ? `${actor} signed this device out` : `${actor} signed out a device`,
    detail: join(text(row.device), text(row.location)),
  }),
  'auth.other_sessions_revoked': ({ actor, row }) => {
    const count = num(row.count) ?? 0;
    return {
      text: `${actor} signed out ${count === 1 ? 'the other device' : `${count} other devices`}`,
      detail: null,
    };
  },
  'auth.email_verified': ({ actor }) => ({
    text: `${actor} verified the email address`,
    detail: null,
  }),
  'auth.oauth_linked': ({ actor, row }) => ({
    text: `${actor} linked ${PROVIDER_WORDS[String(row.provider)] ?? 'a sign-in provider'}`,
    detail: null,
  }),
  'auth.account_deleted': () => ({ text: 'The account was deleted', detail: null }),

  'admin.force_logout': ({ event }) => ({
    text: event.actor?.isYou
      ? 'You signed an account out everywhere'
      : 'An admin signed you out everywhere',
    detail: null,
  }),

  'notification.alert_email_muted': ({ actor }) => ({
    text: `${actor} turned alert emails off`,
    detail: null,
  }),
  'notification.alert_email_unmuted': ({ actor }) => ({
    text: `${actor} turned alert emails back on`,
    detail: null,
  }),
  'notification.preferences_updated': ({ actor }) => ({
    text: `${actor} changed which alerts you get`,
    detail: null,
  }),

  'vehicle_member.added': ({ actor, row }) => ({
    text: `${actor} added someone to the vehicle`,
    detail: text(row.role) ? `as ${String(row.role)}` : null,
  }),
  'vehicle_member.role_changed': (context) => ({
    text: `${context.actor} changed what someone can do`,
    detail: change(context, 'role', text),
  }),
  'vehicle_member.removed': ({ actor }) => ({
    text: `${actor} removed someone from the vehicle`,
    detail: null,
  }),
  'vehicle_member.ownership_transferred': ({ actor }) => ({
    text: `${actor} handed over ownership`,
    detail: null,
  }),

  'vehicle_invite.created': ({ actor, row }) => ({
    text: `${actor} invited ${text(row.email) ?? 'someone'}`,
    detail: text(row.role) ? `as ${String(row.role)}` : null,
  }),
  'vehicle_invite.accepted': ({ actor }) => ({ text: `${actor} accepted an invite`, detail: null }),
  'vehicle_invite.revoked': ({ actor, row }) => ({
    text: `${actor} cancelled the invite to ${text(row.email) ?? 'someone'}`,
    detail: null,
  }),
  'vehicle_invite.declined': ({ actor }) => ({ text: `${actor} declined an invite`, detail: null }),
  'vehicle_invite.resent': ({ actor, row }) => ({
    text: `${actor} sent the invite to ${text(row.email) ?? 'someone'} again`,
    detail: null,
  }),
};

export function hasSentence(action: string): action is AuditActionName {
  return Object.hasOwn(DESCRIBERS, action);
}

function linkFor(event: AuditEvent, row: Payload): ActivityLink | null {
  if (!event.resourceExists || !event.resourceId) return null;
  switch (event.resourceType) {
    case 'vehicle':
      return { to: '/vehicles/$vehicleId', params: { vehicleId: event.resourceId } };
    case 'maintenance_record':
      return { to: '/maintenance-records/$recordId', params: { recordId: event.resourceId } };
    case 'reminder':
      return { to: '/reminders/$reminderId', params: { reminderId: event.resourceId } };
    case 'vehicle_loan':
      return { to: '/costs/loans/$loanId', params: { loanId: event.resourceId } };
    case 'fuel_log':
      return text(row.vehicleId)
        ? {
            to: '/vehicles/$vehicleId',
            params: { vehicleId: row.vehicleId as string },
            search: { tab: 'history', view: 'fuel' },
          }
        : null;
    default:
      return null;
  }
}

/**
 * One audit event as a sentence, actor first: "Priya logged a fuel fill"
 * with "28 L · ₹2,996 · 18,500 km", linking to the record while it exists.
 * An action this version does not know (a newer API) still reads as words.
 */
export function describeAuditEvent(event: AuditEvent): ActivitySentence {
  const row = (event.after ?? event.before ?? {}) as Payload;
  const actor = event.actor ? (event.actor.isYou ? 'You' : event.actor.name) : 'Vehicle Vault';
  const possessive = event.actor ? (event.actor.isYou ? 'Your' : `${event.actor.name}’s`) : 'A';
  const link = linkFor(event, row);

  if (!hasSentence(event.action)) {
    return {
      text: `${actor} made a change`,
      detail: event.action.replace(/[._]/g, ' '),
      link,
      suspicious: false,
    };
  }

  const described = DESCRIBERS[event.action]({ event, row, actor, possessive });
  return { ...described, link, suspicious: described.suspicious ?? false };
}
