import { AuditResourceType, type Prisma, type Reminder as ReminderRow } from '@prisma/client';
import {
  RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE,
  ReminderStatus,
  type ReminderType,
  type VehicleDocument,
} from '@vehicle-vault/shared';

import type { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { isMoreRecentDocument } from '../vehicle-documents/document-recency';
import { computeReminderStatus } from './reminder-status';

/**
 * Renewals are one thing: a reminder of a renewal type (insurance, PUC, road
 * tax, registration) follows the vehicle's paper of that kind.
 *
 * - While linked, its due date is the paper's end date. Editing the paper
 *   moves it; the reminder's own date cannot be set.
 * - Renewing (a newer paper of the kind becomes the one of record) completes
 *   it and links a successor, same title, notes and repeat rule, to the new
 *   paper.
 * - Deleting the paper unlinks it (the foreign key sets null) into a plain
 *   reminder dated where the paper ended.
 * - A paper with no reminder adopts the vehicle's one open, unlinked reminder
 *   of its kind when that reminder is due within {@link RENEWAL_ADOPT_WINDOW_DAYS}
 *   of the paper's end (or has no date). Two candidates, or one further off,
 *   is ambiguous and left alone. Migration `20260925120000_reminder_follows_paper`
 *   applied the same rule to what was already stored.
 *
 * Everything here runs in the caller's transaction and audits each write.
 */

export const RENEWAL_ADOPT_WINDOW_DAYS = 60;

export type RenewalKind = 'insurance' | 'puc' | 'road_tax' | 'registration';
type PaperLink = 'insurancePolicyId' | 'complianceDocumentId';

type Paper = { id: string; startDate: Date | null; endDate: Date | null; createdAt: Date };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isRenewalKind(kind: string): kind is RenewalKind {
  return kind === 'insurance' || kind === 'puc' || kind === 'road_tax' || kind === 'registration';
}

export function renewalKindOf(type: ReminderType | string): RenewalKind | undefined {
  return RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE[type as ReminderType];
}

function linkColumn(kind: RenewalKind): PaperLink {
  return kind === 'insurance' ? 'insurancePolicyId' : 'complianceDocumentId';
}

function reminderTypeFor(kind: RenewalKind): ReminderType {
  const entry = Object.entries(RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE).find(
    ([, documentKind]) => documentKind === kind,
  );
  return entry![0] as ReminderType;
}

/** The paper a linked reminder follows, if any: a row needs at most one of the two. */
export function linkedPaperId(
  reminder: Pick<ReminderRow, 'insurancePolicyId' | 'complianceDocumentId'>,
): string | null {
  return reminder.insurancePolicyId ?? reminder.complianceDocumentId ?? null;
}

async function papersOf(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  kind: RenewalKind,
): Promise<Paper[]> {
  const select = { id: true, startDate: true, endDate: true, createdAt: true } as const;
  return kind === 'insurance'
    ? tx.insurancePolicy.findMany({ where: { vehicleId }, select })
    : tx.complianceDocument.findMany({ where: { vehicleId, kind }, select });
}

/**
 * The paper of record, by the rule the rest of the app uses
 * (`document-recency.ts`); among exact ties, the one entered last.
 */
function latestOf(papers: Paper[]): Paper | undefined {
  const newestFirst = [...papers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let latest: Paper | undefined;
  for (const paper of newestFirst) {
    if (
      !latest ||
      isMoreRecentDocument(
        paper as unknown as VehicleDocument,
        latest as unknown as VehicleDocument,
      )
    ) {
      latest = paper;
    }
  }
  return latest;
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function statusFor(
  reminder: { dueDate: Date | null; dueOdometer: number | null },
  odometer: number | undefined,
  now: Date,
): ReminderStatus {
  return computeReminderStatus(
    {
      dueDate: reminder.dueDate?.toISOString(),
      dueOdometer: reminder.dueOdometer ?? undefined,
    },
    odometer,
    now,
  );
}

type Context = {
  tx: Prisma.TransactionClient;
  auditService: AuditService;
  actorUserId: string;
};

async function audit(
  { tx, auditService, actorUserId }: Context,
  action: string,
  resourceId: string,
  before: unknown,
  after: unknown,
) {
  await auditService.track(tx, {
    actorUserId,
    ownerUserId: actorUserId,
    action,
    resourceType: AuditResourceType.reminder,
    resourceId,
    ...(before ? { before: before as Record<string, unknown> } : {}),
    after: after as Record<string, unknown>,
  });
}

/** Frees a paper held by a completed renewal, so an open one can follow it. */
async function releasePaper(tx: Prisma.TransactionClient, column: PaperLink, paperId: string) {
  await tx.reminder.updateMany({
    where: { [column]: paperId, completedAt: { not: null } },
    data: { [column]: null },
  });
}

/**
 * After a paper of `kind` is added or edited on the vehicle: rolls, re-dates
 * or adopts its renewal reminder by the rules above. Returns the reminders it
 * completed, whose bell the caller can clear.
 */
export async function syncRenewals(
  context: Context,
  vehicleId: string,
  kind: RenewalKind,
  now: Date = new Date(),
): Promise<{ completedReminderIds: string[] }> {
  const { tx } = context;
  const column = linkColumn(kind);
  const papers = await papersOf(tx, vehicleId, kind);
  const latest = latestOf(papers);
  if (!latest) return { completedReminderIds: [] };

  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { odometer: true },
  });
  const odometer = vehicle?.odometer;
  const linkedOpen = await tx.reminder.findMany({
    where: { vehicleId, completedAt: null, [column]: { in: papers.map((paper) => paper.id) } },
    orderBy: { createdAt: 'asc' },
  });
  let following = linkedOpen.find((reminder) => reminder[column] === latest.id);
  const completedReminderIds: string[] = [];

  // Renewed: whatever followed an older paper is done, and its successor
  // follows the new one.
  for (const renewed of linkedOpen.filter((reminder) => reminder[column] !== latest.id)) {
    const completed = await tx.reminder.update({
      where: { id: renewed.id },
      data: { completedAt: now, status: ReminderStatus.Completed },
    });
    await audit(context, AUDIT_ACTIONS.reminder.completed, renewed.id, renewed, completed);
    completedReminderIds.push(renewed.id);

    if (!following && latest.endDate) {
      await releasePaper(tx, column, latest.id);
      const successor = await tx.reminder.create({
        data: {
          vehicleId,
          title: renewed.title,
          type: renewed.type,
          notes: renewed.notes,
          catalogSlug: renewed.catalogSlug,
          repeatEveryMonths: renewed.repeatEveryMonths,
          repeatEveryKm: renewed.repeatEveryKm,
          dueDate: latest.endDate,
          dueOdometer: null,
          status: statusFor({ dueDate: latest.endDate, dueOdometer: null }, odometer, now),
          [column]: latest.id,
        },
      });
      await audit(context, AUDIT_ACTIONS.reminder.created, successor.id, null, successor);
      following = successor;
    }
  }

  if (following) {
    if (!latest.endDate) {
      // The paper no longer runs out (a lifetime road tax): nothing to follow.
      const unlinked = await tx.reminder.update({
        where: { id: following.id },
        data: { [column]: null },
      });
      await audit(context, AUDIT_ACTIONS.reminder.updated, following.id, following, unlinked);
    } else if (following.dueDate?.getTime() !== latest.endDate.getTime()) {
      const redated = await tx.reminder.update({
        where: { id: following.id },
        data: {
          dueDate: latest.endDate,
          status: statusFor({ ...following, dueDate: latest.endDate }, odometer, now),
        },
      });
      await audit(context, AUDIT_ACTIONS.reminder.updated, following.id, following, redated);
    }
    return { completedReminderIds };
  }

  if (!latest.endDate) return { completedReminderIds };

  // Nothing follows the paper yet: adopt the one open reminder of its kind.
  const candidates = await tx.reminder.findMany({
    where: {
      vehicleId,
      type: reminderTypeFor(kind),
      completedAt: null,
      insurancePolicyId: null,
      complianceDocumentId: null,
    },
  });
  const candidate = candidates.length === 1 ? candidates[0] : undefined;
  if (!candidate) return { completedReminderIds };
  if (
    candidate.dueDate &&
    Math.abs(utcDay(candidate.dueDate) - utcDay(latest.endDate)) >
      RENEWAL_ADOPT_WINDOW_DAYS * MS_PER_DAY
  ) {
    return { completedReminderIds };
  }

  await releasePaper(tx, column, latest.id);
  const adopted = await tx.reminder.update({
    where: { id: candidate.id },
    data: {
      [column]: latest.id,
      dueDate: latest.endDate,
      status: statusFor({ ...candidate, dueDate: latest.endDate }, odometer, now),
    },
  });
  await audit(context, AUDIT_ACTIONS.reminder.updated, candidate.id, candidate, adopted);

  return { completedReminderIds };
}

/**
 * A renewal reminder just written (created, or its type changed to one):
 * links it to the vehicle's paper of its kind, when that paper has an end
 * date and nothing open follows it yet. The reminder's date becomes the
 * paper's. Otherwise it stays a plain reminder.
 */
export async function linkRenewalReminder(
  context: Context,
  reminderId: string,
  now: Date = new Date(),
): Promise<void> {
  const { tx } = context;
  const reminder = await tx.reminder.findUnique({
    where: { id: reminderId },
    include: { vehicle: { select: { odometer: true } } },
  });
  if (!reminder || reminder.completedAt || linkedPaperId(reminder)) return;
  const kind = renewalKindOf(reminder.type);
  if (!kind) return;

  const latest = latestOf(await papersOf(tx, reminder.vehicleId, kind));
  if (!latest?.endDate) return;
  const column = linkColumn(kind);
  const taken = await tx.reminder.findFirst({
    where: { [column]: latest.id, completedAt: null },
    select: { id: true },
  });
  if (taken) return;

  await releasePaper(tx, column, latest.id);
  const linked = await tx.reminder.update({
    where: { id: reminder.id },
    data: {
      [column]: latest.id,
      dueDate: latest.endDate,
      status: statusFor({ ...reminder, dueDate: latest.endDate }, reminder.vehicle.odometer, now),
    },
  });
  await audit(context, AUDIT_ACTIONS.reminder.updated, reminder.id, reminder, linked);
}
