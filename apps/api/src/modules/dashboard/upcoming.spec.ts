import {
  FuelType,
  LoanStatus,
  ReminderStatus,
  ReminderType,
  VehicleRole,
  VehicleType,
  type Reminder,
  type VehicleDocument,
} from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardService } from './dashboard.service';

/**
 * The Upcoming timeline and Home's attention queue, run side by side on the
 * same rows. Home must be exactly the timeline's near end: same rows, same
 * order, same counts. The first test builds the demo seed's shape
 * (`prisma/seed-demo.ts`) as the services would return it.
 */

/** "Today" (UTC) is 2026-09-25. */
const NOW = new Date('2026-09-25T06:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.UTC(2026, 8, 25, 12) + days * DAY);
}

function vehicle(id: string, nickname: string, registrationNumber: string, odometer: number) {
  return {
    id,
    registrationNumber,
    make: 'Make',
    model: 'Model',
    variant: null,
    year: 2023,
    fuelType: FuelType.Petrol,
    vehicleType: VehicleType.Car,
    nickname,
    odometer,
    // The seed has just run: a vehicle this new is still being set up, so
    // nothing asks for its tyres or service history yet.
    createdAt: new Date(NOW.getTime() - DAY).toISOString(),
    updatedAt: NOW.toISOString(),
    currentUserRole: VehicleRole.Owner,
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

function paper(
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

/** An active loan whose next instalment falls `inDays` from today. */
function loan(id: string, vehicleId: string, inDays: number) {
  const next = daysFromNow(inDays);
  const start = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() - 7, next.getUTCDate(), 12),
  );

  return {
    id,
    vehicleId,
    status: LoanStatus.Active,
    emiAmount: 4800,
    tenureMonths: 36,
    monthsRemaining: 30,
    startDate: start.toISOString(),
  };
}

const SUV = vehicle('suv', 'Family SUV', 'MH12DM0001', 18500);
const HATCH = vehicle('hatch', 'Daily Hatch', 'MH12DM0002', 32000);
const BIKE = vehicle('bike', 'Weekend Bike', 'MH12DM0003', 8500);
const SECOND = vehicle('second', 'Second Car', 'MH12DM0004', 45000);

/** `prisma/seed-demo.ts`, as the services hand it to the dashboard. */
const DEMO = {
  vehicles: [SUV, HATCH, BIKE, SECOND],
  reminders: [
    // Follows the policy: one renewal, one row (#283).
    reminder({
      id: 'suv-insurance-renewal',
      vehicleId: 'suv',
      title: 'Insurance renewal',
      type: ReminderType.Insurance,
      status: ReminderStatus.Overdue,
      dueDate: daysFromNow(-3).toISOString(),
      renewsDocument: { kind: 'insurance', id: 'suv-insurance' },
    }),
    reminder({
      id: 'suv-alignment',
      vehicleId: 'suv',
      title: 'Wheel alignment check',
      dueDate: daysFromNow(4).toISOString(),
    }),
    reminder({
      id: 'hatch-oil',
      vehicleId: 'hatch',
      title: 'Oil change',
      status: ReminderStatus.DueToday,
      dueDate: daysFromNow(0).toISOString(),
    }),
    reminder({
      id: 'second-timing-belt',
      vehicleId: 'second',
      title: 'Timing belt check',
      dueDate: daysFromNow(20).toISOString(),
    }),
  ],
  documents: [
    paper({
      id: 'suv-insurance',
      vehicleId: 'suv',
      kind: 'insurance',
      provider: 'HDFC ERGO',
      endDate: daysFromNow(-3),
    }),
    paper({ id: 'suv-puc', vehicleId: 'suv', kind: 'puc', endDate: daysFromNow(200) }),
    // Ended 120 days ago: off the timeline, as it is off Home.
    paper({
      id: 'hatch-warranty',
      vehicleId: 'hatch',
      kind: 'warranty',
      endDate: daysFromNow(-120),
    }),
    paper({
      id: 'hatch-insurance',
      vehicleId: 'hatch',
      kind: 'insurance',
      endDate: daysFromNow(212),
    }),
    paper({ id: 'hatch-puc', vehicleId: 'hatch', kind: 'puc', endDate: daysFromNow(151) }),
    paper({
      id: 'hatch-road-tax',
      vehicleId: 'hatch',
      kind: 'road_tax',
      endDate: daysFromNow(600),
    }),
    paper({
      id: 'bike-insurance',
      vehicleId: 'bike',
      kind: 'insurance',
      endDate: daysFromNow(243),
    }),
    paper({ id: 'bike-puc', vehicleId: 'bike', kind: 'puc', endDate: daysFromNow(151) }),
    paper({
      id: 'second-insurance',
      vehicleId: 'second',
      kind: 'insurance',
      endDate: daysFromNow(122),
    }),
    paper({ id: 'second-puc', vehicleId: 'second', kind: 'puc', endDate: daysFromNow(151) }),
  ],
  loans: [loan('bike-loan', 'bike', 2)],
};

describe('Upcoming timeline', () => {
  const vehiclesService = { getAllVehicles: vi.fn() };
  const maintenanceService = { getAllRecords: vi.fn() };
  const remindersService = { getAllReminders: vi.fn() };
  const attachmentsService = { listAllAttachments: vi.fn() };
  const forecastService = { getUpcomingSuggestions: vi.fn() };
  const vehicleLoansService = { listForUser: vi.fn() };
  const vehicleDocumentsService = { listForUser: vi.fn() };
  const prisma = {
    fuelLog: { count: vi.fn(), groupBy: vi.fn() },
    documentDismissal: { findMany: vi.fn() },
    serviceBaseline: { findMany: vi.fn() },
  };
  const tyresService = { getAlertState: vi.fn() };
  const accessoriesService = { findExpiringWarranties: vi.fn() };
  const intervalResolver = { resolveForVehicle: vi.fn() };

  let service: DashboardService;

  function arrange(input: {
    vehicles?: unknown[];
    reminders?: Reminder[];
    documents?: VehicleDocument[];
    loans?: unknown[];
    dismissals?: { documentId: string; dismissedUntil: Date }[];
  }) {
    vehiclesService.getAllVehicles.mockResolvedValue(input.vehicles ?? [SUV]);
    remindersService.getAllReminders.mockResolvedValue(input.reminders ?? []);
    vehicleDocumentsService.listForUser.mockResolvedValue(input.documents ?? []);
    vehicleLoansService.listForUser.mockResolvedValue(input.loans ?? []);
    prisma.documentDismissal.findMany.mockResolvedValue(input.dismissals ?? []);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    maintenanceService.getAllRecords.mockResolvedValue([]);
    attachmentsService.listAllAttachments.mockResolvedValue([]);
    forecastService.getUpcomingSuggestions.mockResolvedValue([]);
    prisma.fuelLog.count.mockResolvedValue(0);
    prisma.fuelLog.groupBy.mockResolvedValue([]);
    prisma.serviceBaseline.findMany.mockResolvedValue([]);
    // As the demo seed leaves them: no tyres on file.
    tyresService.getAlertState.mockResolvedValue({
      vehicleOdometer: 0,
      conditions: [],
      lastObservation: null,
    });
    accessoriesService.findExpiringWarranties.mockResolvedValue([]);
    intervalResolver.resolveForVehicle.mockResolvedValue({});
    arrange({});
    service = new DashboardService(
      vehiclesService as never,
      maintenanceService as never,
      remindersService as never,
      attachmentsService as never,
      forecastService as never,
      vehicleLoansService as never,
      vehicleDocumentsService as never,
      prisma as never,
      { markReadForDocument: vi.fn() } as never,
      tyresService as never,
      accessoriesService as never,
      intervalResolver as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrees with Home on the demo seed: same rows, same order, same counts', async () => {
    arrange(DEMO);

    const summary = await service.getSummary('demo');
    const { timeline, laterTotal } = await service.getUpcoming('demo', {});
    const near = timeline.items.filter((item) => item.urgency !== 'later');

    expect(near.map((item) => item.id)).toEqual(summary.attention.map((item) => item.id));
    expect(timeline.counts.late).toBe(summary.attentionCounts.overdue);
    expect(timeline.counts.this_week).toBe(
      summary.attentionCounts.today + summary.attentionCounts.thisWeek,
    );
    expect(timeline.counts.this_month).toBe(summary.attentionCounts.thisMonth);

    expect(near.map((item) => [item.id, item.urgency])).toEqual([
      ['suv-insurance', 'overdue'],
      ['hatch-oil', 'today'],
      ['emi:bike-loan', 'this_week'],
      ['suv-alignment', 'this_week'],
      ['second-timing-belt', 'this_month'],
    ]);
    // The lapsed policy and its renewal reminder are one row, under the reminder's name.
    expect(near[0]).toMatchObject({
      kind: 'document',
      title: 'Insurance renewal',
      reminderId: 'suv-insurance-renewal',
    });
    expect(timeline.items.map((item) => item.id)).not.toContain('suv-insurance-renewal');
    // Everything else with a date, soonest first; the long-lapsed warranty is not here.
    expect(
      timeline.items.filter((item) => item.urgency === 'later').map((item) => item.id),
    ).toEqual([
      'second-insurance',
      'hatch-puc',
      'second-puc',
      'bike-puc',
      'suv-puc',
      'hatch-insurance',
      'bike-insurance',
      'hatch-road-tax',
    ]);
    expect(laterTotal).toBe(8);
    expect(timeline.counts).toEqual({ late: 1, this_week: 3, this_month: 1, later: 8 });
  });

  it('keeps agreeing when a paper is snoozed: Home drops it, Upcoming holds it for later', async () => {
    arrange({
      ...DEMO,
      documents: DEMO.documents.map((document) =>
        document.id === 'second-insurance' ? { ...document, endDate: daysFromNow(12) } : document,
      ),
      dismissals: [{ documentId: 'second-insurance', dismissedUntil: daysFromNow(14) }],
    });

    const summary = await service.getSummary('demo');
    const { timeline } = await service.getUpcoming('demo', {});

    expect(summary.attention.map((item) => item.id)).not.toContain('second-insurance');
    expect(timeline.counts.this_week).toBe(
      summary.attentionCounts.today + summary.attentionCounts.thisWeek,
    );
    expect(timeline.items.find((item) => item.id === 'second-insurance')).toMatchObject({
      urgency: 'later',
      snoozedUntil: daysFromNow(14).toISOString(),
    });
  });

  it('never lets a snooze hold back a paper that has come due', async () => {
    arrange({
      documents: [paper({ id: 'lapsed', vehicleId: 'suv', kind: 'puc', endDate: daysFromNow(-2) })],
      dismissals: [{ documentId: 'lapsed', dismissedUntil: daysFromNow(10) }],
    });

    const { timeline } = await service.getUpcoming('user-1', {});

    expect(timeline.items).toEqual([expect.objectContaining({ id: 'lapsed', urgency: 'overdue' })]);
    expect(timeline.items[0]).not.toHaveProperty('snoozedUntil');
  });

  it('puts what Home leaves out in later: far dates, far odometers and next month’s EMI', async () => {
    arrange({
      reminders: [
        reminder({ id: 'far-date', vehicleId: 'suv', dueDate: daysFromNow(45).toISOString() }),
        reminder({ id: 'far-km', vehicleId: 'suv', dueOdometer: 18500 + 5000 }),
        reminder({ id: 'near-km', vehicleId: 'suv', dueOdometer: 18500 + 800 }),
        reminder({
          id: 'done',
          vehicleId: 'suv',
          status: ReminderStatus.Completed,
          dueDate: daysFromNow(2).toISOString(),
          completedAt: NOW.toISOString(),
        }),
      ],
      loans: [loan('loan', 'suv', 12)],
    });

    const summary = await service.getSummary('user-1');
    const { timeline } = await service.getUpcoming('user-1', {});

    expect(summary.attention.map((item) => item.id)).toEqual(['near-km']);
    expect(timeline.items.map((item) => [item.id, item.urgency])).toEqual([
      ['near-km', 'this_month'],
      // Dated first, soonest first; then odometer-only by km to go.
      ['emi:loan', 'later'],
      ['far-date', 'later'],
      ['far-km', 'later'],
    ]);
  });

  it('filters by vehicle and by kind, and counts only what the filter keeps', async () => {
    arrange(DEMO);

    const suvOnly = await service.getUpcoming('demo', { vehicleId: 'suv' });
    expect(new Set(suvOnly.timeline.items.map((item) => item.vehicleId))).toEqual(new Set(['suv']));
    expect(suvOnly.timeline.counts).toEqual({ late: 1, this_week: 1, this_month: 0, later: 1 });

    const papers = await service.getUpcoming('demo', { kind: 'papers' });
    expect(new Set(papers.timeline.items.map((item) => item.kind))).toEqual(new Set(['document']));
    expect(papers.timeline.counts).toEqual({ late: 1, this_week: 0, this_month: 0, later: 8 });

    const emis = await service.getUpcoming('demo', { kind: 'emis' });
    expect(emis.timeline.items.map((item) => item.id)).toEqual(['emi:bike-loan']);
  });

  it('names each row’s vehicle with its fuel, so an EV plate can be green (#355)', async () => {
    arrange(DEMO);

    const { timeline } = await service.getUpcoming('demo', {});
    expect(timeline.items.length).toBeGreaterThan(0);
    for (const item of timeline.items) expect(item.vehicleFuelType).toBe(FuelType.Petrol);
  });

  it('pages only the later group; the near groups come whole on every page', async () => {
    arrange(DEMO);

    const first = await service.getUpcoming('demo', { page: 1, limit: 3 });
    const second = await service.getUpcoming('demo', { page: 2, limit: 3 });
    const third = await service.getUpcoming('demo', { page: 3, limit: 3 });
    const laterOf = (items: { id: string; urgency: string }[]) =>
      items.filter((item) => item.urgency === 'later').map((item) => item.id);

    expect(first.timeline.items.filter((item) => item.urgency !== 'later')).toHaveLength(5);
    expect(second.timeline.items.filter((item) => item.urgency !== 'later')).toHaveLength(5);
    expect([
      ...laterOf(first.timeline.items),
      ...laterOf(second.timeline.items),
      ...laterOf(third.timeline.items),
    ]).toEqual([
      'second-insurance',
      'hatch-puc',
      'second-puc',
      'bike-puc',
      'suv-puc',
      'hatch-insurance',
      'bike-insurance',
      'hatch-road-tax',
    ]);
    expect(first.laterTotal).toBe(8);
    expect(first.timeline.counts.later).toBe(8);
  });

  it('reads accessory warranties years ahead for later, where Home reads 30 days', async () => {
    arrange({});

    await service.getSummary('user-1');
    await service.getUpcoming('user-1', {});

    expect(accessoriesService.findExpiringWarranties.mock.calls).toEqual([
      ['user-1', 30],
      ['user-1', 5 * 366],
    ]);
  });
});
