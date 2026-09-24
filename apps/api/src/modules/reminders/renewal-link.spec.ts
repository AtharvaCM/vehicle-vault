import type { Prisma } from '@prisma/client';
import {
  ReminderStatus,
  ReminderType,
  type Reminder,
  type VehicleDocument,
} from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service';
import { buildDueItems, toUtcDay, type DueItemVehicle } from '../dashboard/due-items';
import { linkRenewalReminder, RENEWAL_ADOPT_WINDOW_DAYS, syncRenewals } from './renewal-link';

/**
 * `syncRenewals` and `linkRenewalReminder` against a small in-memory fake of
 * the Prisma transaction client: just the tables and `where` shapes the
 * module actually touches (see `renewal-link.ts`). The fake also enforces the
 * one-reminder-per-paper unique constraint, so a bug that double-links a
 * paper fails loudly instead of silently overwriting a row.
 */

const NOW = new Date('2026-09-25T06:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}

type FakePaper = {
  id: string;
  vehicleId: string;
  kind?: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
};

type FakeReminder = {
  id: string;
  vehicleId: string;
  title: string;
  type: string;
  dueDate: Date | null;
  dueOdometer: number | null;
  status: ReminderStatus;
  completedAt: Date | null;
  notes: string | null;
  catalogSlug: string | null;
  repeatEveryMonths: number | null;
  repeatEveryKm: number | null;
  insurancePolicyId: string | null;
  complianceDocumentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const REMINDER_COLUMNS = ['insurancePolicyId', 'complianceDocumentId'] as const;

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition === null) return value === null;
  if (typeof condition === 'object') {
    const record = condition as Record<string, unknown>;
    if ('not' in record) {
      return record.not === null ? value !== null : value !== record.not;
    }
    if ('in' in record) {
      return (record.in as unknown[]).includes(value);
    }
  }
  return value === condition;
}

function matchesWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) =>
    matchesCondition(record[key], condition),
  );
}

/** A small in-memory stand-in for the tables `renewal-link.ts` reads and writes. */
class FakeDb {
  vehicles = new Map<string, { odometer: number }>();
  policies = new Map<string, FakePaper>();
  compliance = new Map<string, FakePaper>();
  reminders = new Map<string, FakeReminder>();
  private nextId = 1;
  private clock = new Date('2026-01-01T00:00:00.000Z').getTime();

  private stamp(): Date {
    this.clock += 1000;
    return new Date(this.clock);
  }

  addVehicle(id: string, odometer: number): void {
    this.vehicles.set(id, { odometer });
  }

  addPolicy(paper: Omit<FakePaper, 'kind'>): FakePaper {
    const stored = { ...paper };
    this.policies.set(paper.id, stored);
    return stored;
  }

  addCompliance(paper: FakePaper & { kind: string }): FakePaper {
    const stored = { ...paper };
    this.compliance.set(paper.id, stored);
    return stored;
  }

  setPolicyEndDate(id: string, endDate: Date): void {
    const paper = this.policies.get(id);
    if (!paper) throw new Error(`policy ${id} not found`);
    this.policies.set(id, { ...paper, endDate });
  }

  addReminder(
    reminder: Partial<FakeReminder> & Pick<FakeReminder, 'id' | 'vehicleId' | 'type'>,
  ): FakeReminder {
    const full: FakeReminder = {
      title: 'Reminder',
      dueDate: null,
      dueOdometer: null,
      status: ReminderStatus.Upcoming,
      completedAt: null,
      notes: null,
      catalogSlug: null,
      repeatEveryMonths: null,
      repeatEveryKm: null,
      insurancePolicyId: null,
      complianceDocumentId: null,
      createdAt: this.stamp(),
      updatedAt: this.stamp(),
      ...reminder,
    };
    this.reminders.set(full.id, full);
    return full;
  }

  patchReminder(id: string, patch: Partial<FakeReminder>): void {
    const existing = this.reminders.get(id);
    if (!existing) throw new Error(`reminder ${id} not found`);
    this.reminders.set(id, { ...existing, ...patch });
  }

  /** Real Postgres would refuse this: at most one open/completed reminder per paper. */
  private assertUnique(record: FakeReminder): void {
    for (const column of REMINDER_COLUMNS) {
      const value = record[column];
      if (value === null) continue;
      for (const [id, other] of this.reminders) {
        if (id === record.id) continue;
        if (other[column] === value) {
          throw new Error(`Unique constraint failed on the fields: (\`${column}\`)`);
        }
      }
    }
  }

  /** A `Prisma.TransactionClient`-shaped object implementing only what the module calls. */
  tx(): Prisma.TransactionClient {
    const fake = {
      vehicle: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const vehicle = this.vehicles.get(where.id);
          return vehicle ? { odometer: vehicle.odometer } : null;
        },
      },
      insurancePolicy: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          [...this.policies.values()]
            .filter((paper) => matchesWhere(paper, where))
            .map(({ id, startDate, endDate, createdAt }) => ({
              id,
              startDate,
              endDate,
              createdAt,
            })),
      },
      complianceDocument: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          [...this.compliance.values()]
            .filter((paper) => matchesWhere(paper, where))
            .map(({ id, startDate, endDate, createdAt }) => ({
              id,
              startDate,
              endDate,
              createdAt,
            })),
      },
      reminder: {
        findMany: async ({
          where,
          orderBy,
        }: {
          where?: Record<string, unknown>;
          orderBy?: { createdAt: 'asc' | 'desc' };
        }) => {
          let rows = [...this.reminders.values()].filter((row) => matchesWhere(row, where ?? {}));
          if (orderBy?.createdAt) {
            const direction = orderBy.createdAt === 'asc' ? 1 : -1;
            rows = [...rows].sort(
              (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
            );
          }
          return rows.map((row) => ({ ...row }));
        },
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          const row = [...this.reminders.values()].find((candidate) =>
            matchesWhere(candidate, where),
          );
          return row ? { ...row } : null;
        },
        findUnique: async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { vehicle?: unknown };
        }) => {
          const row = this.reminders.get(where.id);
          if (!row) return null;
          const vehicle = this.vehicles.get(row.vehicleId);
          return {
            ...row,
            ...(include?.vehicle ? { vehicle: { odometer: vehicle?.odometer ?? 0 } } : {}),
          };
        },
        create: async ({ data }: { data: Partial<FakeReminder> }) => {
          const created: FakeReminder = {
            id: `reminder-${this.nextId++}`,
            vehicleId: data.vehicleId as string,
            title: data.title as string,
            type: data.type as string,
            dueDate: data.dueDate ?? null,
            dueOdometer: data.dueOdometer ?? null,
            status: (data.status as ReminderStatus) ?? ReminderStatus.Upcoming,
            completedAt: data.completedAt ?? null,
            notes: data.notes ?? null,
            catalogSlug: data.catalogSlug ?? null,
            repeatEveryMonths: data.repeatEveryMonths ?? null,
            repeatEveryKm: data.repeatEveryKm ?? null,
            insurancePolicyId: data.insurancePolicyId ?? null,
            complianceDocumentId: data.complianceDocumentId ?? null,
            createdAt: this.stamp(),
            updatedAt: this.stamp(),
          };
          this.assertUnique(created);
          this.reminders.set(created.id, created);
          return { ...created };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<FakeReminder> }) => {
          const existing = this.reminders.get(where.id);
          if (!existing) throw new Error(`Reminder ${where.id} not found`);
          const updated: FakeReminder = { ...existing, ...data, updatedAt: this.stamp() };
          this.assertUnique(updated);
          this.reminders.set(where.id, updated);
          return { ...updated };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<FakeReminder>;
        }) => {
          let count = 0;
          for (const [id, row] of this.reminders) {
            if (matchesWhere(row, where)) {
              this.reminders.set(id, { ...row, ...data, updatedAt: this.stamp() });
              count += 1;
            }
          }
          return { count };
        },
      },
    };
    return fake as unknown as Prisma.TransactionClient;
  }
}

function makeContext(db: FakeDb) {
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };
  return {
    context: {
      tx: db.tx(),
      auditService: auditService as unknown as AuditService,
      actorUserId: 'user-1',
    },
    auditService,
  };
}

describe('syncRenewals', () => {
  it('adopts the vehicle’s one open unlinked reminder within the adopt window', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    const policy = db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-360),
      endDate: daysFromNow(5),
      createdAt: daysFromNow(-360),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(-3),
      status: ReminderStatus.Overdue,
    });
    const { context, auditService } = makeContext(db);

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    const updated = db.reminders.get('rem-1')!;
    expect(updated.insurancePolicyId).toBe('policy-1');
    expect(updated.dueDate?.getTime()).toBe(policy.endDate!.getTime());
    expect(updated.status).toBe(ReminderStatus.Upcoming);
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'reminder.updated', resourceId: 'rem-1' }),
    );
  });

  it('does not adopt when two open unlinked reminders make it ambiguous', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-360),
      endDate: daysFromNow(5),
      createdAt: daysFromNow(-360),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(-3),
    });
    db.addReminder({
      id: 'rem-2',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(2),
    });
    const { context, auditService } = makeContext(db);

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    expect(db.reminders.get('rem-1')!.insurancePolicyId).toBeNull();
    expect(db.reminders.get('rem-2')!.insurancePolicyId).toBeNull();
    expect(auditService.track).not.toHaveBeenCalled();
  });

  it('does not adopt a candidate due further off than the adopt window', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-360),
      endDate: daysFromNow(5),
      createdAt: daysFromNow(-360),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      // 100 days from the policy's end date: further than RENEWAL_ADOPT_WINDOW_DAYS.
      dueDate: daysFromNow(5 + RENEWAL_ADOPT_WINDOW_DAYS + 40),
    });
    const { context } = makeContext(db);

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    expect(db.reminders.get('rem-1')!.insurancePolicyId).toBeNull();
  });

  it('does not adopt when the paper has no end date', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addCompliance({
      id: 'tax-1',
      vehicleId: 'veh-1',
      kind: 'road_tax',
      startDate: daysFromNow(-100),
      endDate: null,
      createdAt: daysFromNow(-100),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Tax,
      dueDate: daysFromNow(3),
    });
    const { context } = makeContext(db);

    const result = await syncRenewals(context, 'veh-1', 'road_tax', NOW);

    expect(result.completedReminderIds).toEqual([]);
    expect(db.reminders.get('rem-1')!.complianceDocumentId).toBeNull();
  });

  it('re-dates the linked reminder when the paper’s end date moves, without creating a new reminder', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-360),
      endDate: daysFromNow(5),
      createdAt: daysFromNow(-360),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      insurancePolicyId: 'policy-1',
      dueDate: daysFromNow(5),
      status: ReminderStatus.Upcoming,
    });
    const { context, auditService } = makeContext(db);

    db.setPolicyEndDate('policy-1', daysFromNow(40));
    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    expect(db.reminders.size).toBe(1);
    const updated = db.reminders.get('rem-1')!;
    expect(updated.dueDate?.getTime()).toBe(daysFromNow(40).getTime());
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'reminder.updated', resourceId: 'rem-1' }),
    );
  });

  it('rolls onto a newer policy: completes the old reminder and links a successor, idempotently', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-old',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-370),
      endDate: daysFromNow(-5),
      createdAt: daysFromNow(-370),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      title: 'Insurance renewal',
      notes: 'Call the agent first',
      repeatEveryMonths: 12,
      insurancePolicyId: 'policy-old',
      dueDate: daysFromNow(-5),
      status: ReminderStatus.Overdue,
    });
    const { context, auditService } = makeContext(db);
    const newPolicy = db.addPolicy({
      id: 'policy-new',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-5),
      endDate: daysFromNow(360),
      createdAt: daysFromNow(-5),
    });

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual(['rem-1']);
    const completed = db.reminders.get('rem-1')!;
    expect(completed.completedAt?.getTime()).toBe(NOW.getTime());
    expect(completed.status).toBe(ReminderStatus.Completed);

    const successors = [...db.reminders.values()].filter((row) => row.id !== 'rem-1');
    expect(successors).toHaveLength(1);
    const successor = successors[0]!;
    expect(successor.insurancePolicyId).toBe('policy-new');
    expect(successor.title).toBe('Insurance renewal');
    expect(successor.notes).toBe('Call the agent first');
    expect(successor.repeatEveryMonths).toBe(12);
    expect(successor.dueDate?.getTime()).toBe(newPolicy.endDate!.getTime());

    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'reminder.completed', resourceId: 'rem-1' }),
    );
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'reminder.created', resourceId: successor.id }),
    );

    auditService.track.mockClear();
    const again = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(again.completedReminderIds).toEqual([]);
    expect(db.reminders.size).toBe(2);
    expect(auditService.track).not.toHaveBeenCalled();
  });

  it('does not roll onto a back-filled older policy', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-current',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-100),
      endDate: daysFromNow(260),
      createdAt: daysFromNow(-100),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      insurancePolicyId: 'policy-current',
      dueDate: daysFromNow(260),
      status: ReminderStatus.Upcoming,
    });
    const { context, auditService } = makeContext(db);

    // Entered after the current policy, but its own startDate is older: a
    // back-filled record, not a renewal.
    db.addPolicy({
      id: 'policy-backfill',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-500),
      endDate: daysFromNow(-140),
      createdAt: daysFromNow(-1),
    });

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    expect(db.reminders.get('rem-1')!.insurancePolicyId).toBe('policy-current');
    expect(db.reminders.size).toBe(1);
    expect(auditService.track).not.toHaveBeenCalled();
  });

  it('links a puc reminder via complianceDocumentId', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addCompliance({
      id: 'puc-1',
      vehicleId: 'veh-1',
      kind: 'puc',
      startDate: daysFromNow(-170),
      endDate: daysFromNow(10),
      createdAt: daysFromNow(-170),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Puc,
      dueDate: daysFromNow(8),
    });
    const { context } = makeContext(db);

    await syncRenewals(context, 'veh-1', 'puc', NOW);

    const updated = db.reminders.get('rem-1')!;
    expect(updated.complianceDocumentId).toBe('puc-1');
    expect(updated.insurancePolicyId).toBeNull();
  });

  it('links a tax reminder to the road-tax renewal via complianceDocumentId', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addCompliance({
      id: 'tax-1',
      vehicleId: 'veh-1',
      kind: 'road_tax',
      startDate: daysFromNow(-350),
      endDate: daysFromNow(15),
      createdAt: daysFromNow(-350),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Tax,
      dueDate: daysFromNow(20),
    });
    const { context } = makeContext(db);

    await syncRenewals(context, 'veh-1', 'road_tax', NOW);

    const updated = db.reminders.get('rem-1')!;
    expect(updated.complianceDocumentId).toBe('tax-1');
  });

  it('keeps the reminder’s dueDate after the paper is deleted (FK SET NULL), and a later sync with no paper is a no-op', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-360),
      endDate: daysFromNow(5),
      createdAt: daysFromNow(-360),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      insurancePolicyId: 'policy-1',
      dueDate: daysFromNow(5),
      status: ReminderStatus.Upcoming,
    });
    const { context, auditService } = makeContext(db);

    // Simulate the FK's ON DELETE SET NULL: the paper is gone, the reminder's
    // column is nulled, its dueDate is left as it was.
    db.policies.delete('policy-1');
    db.patchReminder('rem-1', { insurancePolicyId: null });
    auditService.track.mockClear();

    const result = await syncRenewals(context, 'veh-1', 'insurance', NOW);

    expect(result.completedReminderIds).toEqual([]);
    const after = db.reminders.get('rem-1')!;
    expect(after.dueDate?.getTime()).toBe(daysFromNow(5).getTime());
    expect(after.insurancePolicyId).toBeNull();
    expect(auditService.track).not.toHaveBeenCalled();
  });
});

describe('linkRenewalReminder', () => {
  it('links a new insurance reminder to the latest policy with an end date', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-100),
      endDate: daysFromNow(200),
      createdAt: daysFromNow(-100),
    });
    db.addReminder({
      id: 'rem-1',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(50),
      status: ReminderStatus.Upcoming,
    });
    const { context, auditService } = makeContext(db);

    await linkRenewalReminder(context, 'rem-1', NOW);

    const updated = db.reminders.get('rem-1')!;
    expect(updated.insurancePolicyId).toBe('policy-1');
    expect(updated.dueDate?.getTime()).toBe(daysFromNow(200).getTime());
    expect(auditService.track).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'reminder.updated', resourceId: 'rem-1' }),
    );
  });

  it('leaves it plain when an open reminder already follows that policy', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-100),
      endDate: daysFromNow(200),
      createdAt: daysFromNow(-100),
    });
    db.addReminder({
      id: 'rem-existing',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      insurancePolicyId: 'policy-1',
      dueDate: daysFromNow(200),
      status: ReminderStatus.Upcoming,
    });
    db.addReminder({
      id: 'rem-new',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(50),
      status: ReminderStatus.Upcoming,
    });
    const { context, auditService } = makeContext(db);

    await linkRenewalReminder(context, 'rem-new', NOW);

    expect(db.reminders.get('rem-new')!.insurancePolicyId).toBeNull();
    expect(auditService.track).not.toHaveBeenCalled();
  });

  it('frees a policy held only by a completed reminder and links the new one', async () => {
    const db = new FakeDb();
    db.addVehicle('veh-1', 10000);
    db.addPolicy({
      id: 'policy-1',
      vehicleId: 'veh-1',
      startDate: daysFromNow(-100),
      endDate: daysFromNow(200),
      createdAt: daysFromNow(-100),
    });
    db.addReminder({
      id: 'rem-old',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      insurancePolicyId: 'policy-1',
      dueDate: daysFromNow(200),
      status: ReminderStatus.Completed,
      completedAt: NOW,
    });
    db.addReminder({
      id: 'rem-new',
      vehicleId: 'veh-1',
      type: ReminderType.Insurance,
      dueDate: daysFromNow(60),
      status: ReminderStatus.Upcoming,
    });
    const { context } = makeContext(db);

    await linkRenewalReminder(context, 'rem-new', NOW);

    expect(db.reminders.get('rem-old')!.insurancePolicyId).toBeNull();
    const updated = db.reminders.get('rem-new')!;
    expect(updated.insurancePolicyId).toBe('policy-1');
    expect(updated.dueDate?.getTime()).toBe(daysFromNow(200).getTime());
  });
});

/**
 * `buildDueItems` renders a linked renewal as one row (the acceptance's
 * "no double-count"). These tests exercise it directly, alongside the
 * unlink-on-delete row it falls back to.
 */
describe('buildDueItems with renewal reminders', () => {
  function dueItemVehicle(id: string): DueItemVehicle {
    return {
      id,
      nickname: 'Vehicle',
      make: 'Make',
      model: 'Model',
      registrationNumber: 'MH12AB1234',
      odometer: 10000,
    };
  }

  function reminder(overrides: Partial<Reminder> & Pick<Reminder, 'id' | 'vehicleId'>): Reminder {
    return {
      title: 'Reminder',
      type: ReminderType.Service,
      status: ReminderStatus.Upcoming,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function document(
    overrides: Partial<VehicleDocument> & Pick<VehicleDocument, 'id' | 'vehicleId' | 'kind'>,
  ): VehicleDocument {
    return {
      provider: null,
      number: null,
      startDate: daysFromNow(-300),
      endDate: daysFromNow(60),
      notes: null,
      details: {},
      createdAt: daysFromNow(-300),
      updatedAt: daysFromNow(-300),
      ...overrides,
    };
  }

  const today = toUtcDay(NOW);

  it('a reminder without renewsDocument shows as its own reminder row', () => {
    const items = buildDueItems({
      vehicleById: new Map([['veh-1', dueItemVehicle('veh-1')]]),
      reminders: [
        reminder({
          id: 'rem-1',
          vehicleId: 'veh-1',
          title: 'Insurance renewal',
          type: ReminderType.Insurance,
          dueDate: daysFromNow(5).toISOString(),
        }),
      ],
      latestDocuments: new Map(),
      activeLoans: [],
      verdictsByVehicle: new Map(),
      expiringAccessories: [],
      today,
      documentSnoozes: new Map(),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'reminder', id: 'rem-1', title: 'Insurance renewal' });
  });

  it('a linked open reminder and its paper collapse into one document row', () => {
    const policyDoc = document({
      id: 'policy-1',
      vehicleId: 'veh-1',
      kind: 'insurance',
      endDate: daysFromNow(5),
    });
    const items = buildDueItems({
      vehicleById: new Map([['veh-1', dueItemVehicle('veh-1')]]),
      reminders: [
        reminder({
          id: 'rem-1',
          vehicleId: 'veh-1',
          title: 'Insurance renewal',
          type: ReminderType.Insurance,
          dueDate: daysFromNow(5).toISOString(),
          renewsDocument: { kind: 'insurance', id: 'policy-1' },
        }),
      ],
      latestDocuments: new Map([['veh-1:insurance', policyDoc]]),
      activeLoans: [],
      verdictsByVehicle: new Map(),
      expiringAccessories: [],
      today,
      documentSnoozes: new Map(),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'document',
      id: 'policy-1',
      title: 'Insurance renewal',
      reminderId: 'rem-1',
    });
  });

  it('a completed linked reminder does not rename the document row', () => {
    const policyDoc = document({
      id: 'policy-1',
      vehicleId: 'veh-1',
      kind: 'insurance',
      endDate: daysFromNow(5),
    });
    const items = buildDueItems({
      vehicleById: new Map([['veh-1', dueItemVehicle('veh-1')]]),
      reminders: [
        reminder({
          id: 'rem-1',
          vehicleId: 'veh-1',
          title: 'Insurance renewal',
          type: ReminderType.Insurance,
          status: ReminderStatus.Completed,
          completedAt: daysFromNow(-1).toISOString(),
          renewsDocument: { kind: 'insurance', id: 'policy-1' },
        }),
      ],
      latestDocuments: new Map([['veh-1:insurance', policyDoc]]),
      activeLoans: [],
      verdictsByVehicle: new Map(),
      expiringAccessories: [],
      today,
      documentSnoozes: new Map(),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'document', id: 'policy-1', title: 'Insurance policy' });
    expect(items[0]).not.toHaveProperty('reminderId');
  });

  it('a linked reminder whose paper is not emitted (ended over 90 days ago) still shows as its own reminder row', () => {
    const longExpired = daysFromNow(-100);
    const policyDoc = document({
      id: 'policy-1',
      vehicleId: 'veh-1',
      kind: 'insurance',
      endDate: longExpired,
    });
    const items = buildDueItems({
      vehicleById: new Map([['veh-1', dueItemVehicle('veh-1')]]),
      reminders: [
        reminder({
          id: 'rem-1',
          vehicleId: 'veh-1',
          title: 'Insurance renewal',
          type: ReminderType.Insurance,
          status: ReminderStatus.Overdue,
          dueDate: longExpired.toISOString(),
          renewsDocument: { kind: 'insurance', id: 'policy-1' },
        }),
      ],
      latestDocuments: new Map([['veh-1:insurance', policyDoc]]),
      activeLoans: [],
      verdictsByVehicle: new Map(),
      expiringAccessories: [],
      today,
      documentSnoozes: new Map(),
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'reminder', id: 'rem-1', title: 'Insurance renewal' });
  });
});
