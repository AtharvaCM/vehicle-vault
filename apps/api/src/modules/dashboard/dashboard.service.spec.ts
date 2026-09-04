import {
  AttachmentKind,
  FuelType,
  LoanStatus,
  MaintenanceCategory,
  ReminderStatus,
  ReminderType,
  VehicleRole,
  VehicleType,
  type MaintenanceRecord,
  type Reminder,
  type VehicleDocument,
} from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardService } from './dashboard.service';

/** Every test runs at this instant; "today" (UTC) is 2026-03-20. */
const NOW = new Date('2026-03-20T09:00:00.000Z');

function daysFromNow(days: number): string {
  const date = new Date(Date.UTC(2026, 2, 20));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function makeVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vehicle-1',
    registrationNumber: 'MH12AB1234',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2022,
    fuelType: FuelType.Petrol,
    odometer: 12000,
    vehicleType: VehicleType.Car,
    nickname: 'Family car',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'reminder-1',
    vehicleId: 'vehicle-1',
    title: 'Service due',
    type: ReminderType.Service,
    dueDate: daysFromNow(3),
    dueOdometer: undefined,
    status: ReminderStatus.Upcoming,
    completedAt: undefined,
    notes: undefined,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    category: MaintenanceCategory.EngineOil,
    serviceDate: '2026-03-18T00:00:00.000Z',
    odometer: 12000,
    workshopName: 'Trusted Garage',
    totalCost: 2499,
    notes: undefined,
    nextDueDate: undefined,
    nextDueOdometer: undefined,
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocument(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'document-1',
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: 'Acme Insurance',
    number: 'POL-1',
    startDate: new Date('2025-03-20T00:00:00.000Z'),
    endDate: new Date(daysFromNow(200)),
    notes: null,
    details: {},
    createdAt: new Date('2025-03-20T00:00:00.000Z'),
    updatedAt: new Date('2025-03-20T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * Next EMI = startDate + (tenureMonths - monthsRemaining + 1) months. With
 * 36 months tenure and 34 remaining, that is startDate + 3 months.
 */
function makeLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-1',
    vehicleId: 'vehicle-1',
    lender: 'Bank',
    principal: 500000,
    interestRate: 9,
    tenureMonths: 36,
    startDate: '2025-12-23T00:00:00.000Z',
    currencyCode: 'INR',
    emiAmount: 15900,
    status: LoanStatus.Active,
    closedAt: null,
    monthsRemaining: 34,
    outstandingBalance: 480000,
    interestPaidToDate: 7000,
    principalPaidToDate: 20000,
    prepaidToDate: 0,
    totalInterest: 72000,
    totalPayable: 572000,
    endDate: '2028-12-23T00:00:00.000Z',
    prepayments: [],
    createdAt: '2025-12-23T00:00:00.000Z',
    updatedAt: '2025-12-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('DashboardService', () => {
  const vehiclesService = {
    getAllVehicles: vi.fn(),
  };
  const maintenanceService = {
    getAllRecords: vi.fn(),
  };
  const remindersService = {
    getAllReminders: vi.fn(),
  };
  const attachmentsService = {
    listAllAttachments: vi.fn(),
  };
  const forecastService = {
    getUpcomingSuggestions: vi.fn(),
  };
  const vehicleLoansService = {
    listForUser: vi.fn(),
  };
  const vehicleDocumentsService = {
    listForUser: vi.fn(),
    assertViewable: vi.fn(),
  };
  const notificationsService = {
    markReadForDocument: vi.fn(),
  };
  const prisma = {
    fuelLog: { count: vi.fn(), groupBy: vi.fn() },
    documentDismissal: { findMany: vi.fn(), upsert: vi.fn() },
  };

  let service: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vehiclesService.getAllVehicles.mockResolvedValue([]);
    maintenanceService.getAllRecords.mockResolvedValue([]);
    remindersService.getAllReminders.mockResolvedValue([]);
    attachmentsService.listAllAttachments.mockResolvedValue([]);
    forecastService.getUpcomingSuggestions.mockResolvedValue([]);
    vehicleLoansService.listForUser.mockResolvedValue([]);
    vehicleDocumentsService.listForUser.mockResolvedValue([]);
    prisma.fuelLog.count.mockResolvedValue(0);
    prisma.fuelLog.groupBy.mockResolvedValue([]);
    prisma.documentDismissal.findMany.mockResolvedValue([]);
    service = new DashboardService(
      vehiclesService as never,
      maintenanceService as never,
      remindersService as never,
      attachmentsService as never,
      forecastService as never,
      vehicleLoansService as never,
      vehicleDocumentsService as never,
      prisma as never,
      notificationsService as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates counts and recent activity from user-scoped services', async () => {
    vehiclesService.getAllVehicles.mockResolvedValue([
      {
        id: 'vehicle-1',
        registrationNumber: 'MH12AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        year: 2022,
        fuelType: FuelType.Petrol,
        odometer: 12000,
        vehicleType: VehicleType.Car,
        nickname: 'Family car',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ]);
    maintenanceService.getAllRecords.mockResolvedValue([
      {
        id: 'record-1',
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.EngineOil,
        serviceDate: '2026-03-18T00:00:00.000Z',
        odometer: 12000,
        workshopName: 'Trusted Garage',
        totalCost: 2499,
        notes: undefined,
        nextDueDate: undefined,
        nextDueOdometer: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ]);
    remindersService.getAllReminders.mockResolvedValue([
      {
        id: 'reminder-1',
        vehicleId: 'vehicle-1',
        title: 'Insurance renewal',
        type: ReminderType.Insurance,
        dueDate: '2026-03-19T00:00:00.000Z',
        dueOdometer: undefined,
        status: ReminderStatus.Overdue,
        completedAt: undefined,
        notes: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-19T00:00:00.000Z',
      },
      {
        id: 'reminder-2',
        vehicleId: 'vehicle-1',
        title: 'Service due',
        type: ReminderType.Service,
        dueDate: '2026-03-21T00:00:00.000Z',
        dueOdometer: undefined,
        status: ReminderStatus.Upcoming,
        completedAt: undefined,
        notes: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ]);
    attachmentsService.listAllAttachments.mockResolvedValue([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Document,
        fileName: 'stored-receipt.pdf',
        originalFileName: 'receipt.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/api/attachments/attachment-1/file',
        uploadedAt: '2026-03-18T00:00:00.000Z',
      },
    ]);
    forecastService.getUpcomingSuggestions.mockResolvedValue([]);

    const result = await service.getSummary('user-1');

    expect(result.totalVehicles).toBe(1);
    expect(result.totalMaintenanceRecords).toBe(1);
    expect(result.totalAttachments).toBe(1);
    expect(result.reminderCounts).toEqual({
      overdue: 1,
      dueToday: 0,
      upcoming: 1,
      completed: 0,
    });
    expect(result.recentMaintenance[0]?.attachmentCount).toBe(1);
    expect(prisma.fuelLog.count).toHaveBeenCalledWith({
      where: { vehicle: { members: { some: { userId: 'user-1' } } } },
    });
    expect(vehicleDocumentsService.listForUser).toHaveBeenCalledWith('user-1');
  });

  describe('attention queue', () => {
    it('(a) buckets dated reminders by status and days until due, dropping anything past 30 days', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({
          id: 'far',
          title: 'Far away',
          dueDate: daysFromNow(45),
          status: ReminderStatus.Upcoming,
        }),
        makeReminder({
          id: 'soon',
          title: 'Soon',
          dueDate: daysFromNow(3),
          status: ReminderStatus.Upcoming,
        }),
        makeReminder({
          id: 'today',
          title: 'Today',
          dueDate: daysFromNow(0),
          status: ReminderStatus.DueToday,
        }),
        makeReminder({
          id: 'late',
          title: 'Late',
          type: ReminderType.Insurance,
          dueDate: daysFromNow(-2),
          status: ReminderStatus.Overdue,
        }),
        makeReminder({
          id: 'done',
          title: 'Done',
          dueDate: daysFromNow(-5),
          status: ReminderStatus.Completed,
        }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention.map((item) => [item.id, item.urgency, item.daysUntilDue])).toEqual([
        ['late', 'overdue', -2],
        ['today', 'today', 0],
        ['soon', 'this_week', 3],
      ]);
      expect(result.attention[0]).toMatchObject({
        kind: 'reminder',
        title: 'Late',
        reminderType: ReminderType.Insurance,
        reminderStatus: ReminderStatus.Overdue,
        dueDate: daysFromNow(-2),
        vehicleId: 'vehicle-1',
        vehicleName: 'Family car',
        registrationNumber: 'MH12AB1234',
        currentUserRole: VehicleRole.Owner,
      });
      expect(result.attentionTotal).toBe(3);
      expect(result.attentionCounts).toEqual({
        overdue: 1,
        today: 1,
        thisWeek: 1,
        thisMonth: 0,
        documentsExpiring30d: 0,
        vehiclesNeedingAttention: 1,
        urgentVehicles: 1,
        total: 3,
      });
    });

    it('(b) surfaces odometer-only reminders within 1000 km as this_month and drops the rest', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle({ odometer: 12000 })]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({ id: 'far-km', dueDate: undefined, dueOdometer: 14000 }),
        makeReminder({ id: 'near-km', dueDate: undefined, dueOdometer: 12800 }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0]).toMatchObject({
        id: 'near-km',
        urgency: 'this_month',
        dueDate: null,
        daysUntilDue: null,
        dueOdometer: 12800,
        kmUntilDue: 800,
      });
      expect(result.attentionCounts.thisMonth).toBe(1);
    });

    it('(c) lists documents expired within 90 days as overdue and marks older expiries only on the vehicle', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([
        makeVehicle({ id: 'vehicle-1', nickname: 'Recent lapse' }),
        makeVehicle({ id: 'vehicle-2', nickname: 'Old lapse', registrationNumber: 'MH12CD5678' }),
      ]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({
          id: 'doc-recent',
          vehicleId: 'vehicle-1',
          endDate: new Date(daysFromNow(-10)),
          provider: 'Recent Insurer',
        }),
        makeDocument({
          id: 'doc-old',
          vehicleId: 'vehicle-2',
          endDate: new Date(daysFromNow(-120)),
        }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0]).toMatchObject({
        id: 'doc-recent',
        kind: 'document',
        urgency: 'overdue',
        title: 'Insurance policy',
        documentKind: 'insurance',
        provider: 'Recent Insurer',
        dueDate: daysFromNow(-10),
        daysUntilDue: -10,
        vehicleId: 'vehicle-1',
      });
      expect(result.attentionCounts.documentsExpiring30d).toBe(1);

      const recent = result.vehicles.find((vehicle) => vehicle.id === 'vehicle-1');
      const old = result.vehicles.find((vehicle) => vehicle.id === 'vehicle-2');
      expect(recent?.documents.insurance).toEqual({ state: 'expired', endDate: daysFromNow(-10) });
      expect(recent?.status).toBe('overdue');
      expect(old?.documents.insurance).toEqual({ state: 'expired', endDate: daysFromNow(-120) });
      expect(old?.status).toBe('ok');
    });

    it('(d) ignores a superseded policy when a newer one of the same kind is active', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'doc-new', endDate: new Date(daysFromNow(355)) }),
        makeDocument({ id: 'doc-old', endDate: new Date(daysFromNow(-10)) }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toEqual([]);
      expect(result.attentionCounts.documentsExpiring30d).toBe(0);
      expect(result.vehicles[0]?.documents.insurance).toEqual({
        state: 'active',
        endDate: daysFromNow(355),
      });
      expect(result.vehicles[0]?.status).toBe('ok');
    });

    it('(d2) does not let an older open-ended document mask a dated renewal of the same kind', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({
          id: 'puc-old',
          kind: 'puc',
          startDate: new Date('2025-01-01T00:00:00.000Z'),
          endDate: null,
        }),
        makeDocument({
          id: 'puc-new',
          kind: 'puc',
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          endDate: new Date(daysFromNow(3)),
        }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0]).toMatchObject({
        id: 'puc-new',
        kind: 'document',
        urgency: 'this_week',
        daysUntilDue: 3,
      });
      expect(result.vehicles[0]?.documents.puc).toEqual({
        state: 'expiring',
        endDate: daysFromNow(3),
      });
    });

    it('(e) reports insurance and PUC as missing when the vehicle has none on file', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'doc-warranty', kind: 'warranty', endDate: null }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.vehicles[0]?.documents).toEqual({
        insurance: { state: 'missing', endDate: null },
        puc: { state: 'missing', endDate: null },
        warranty: { state: 'active', endDate: null },
      });
    });

    it('(f) adds an EMI item for an active loan whose next instalment is within 7 days', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleLoansService.listForUser.mockResolvedValue([
        makeLoan(),
        makeLoan({ id: 'loan-closed', status: LoanStatus.Closed, emiAmount: 999 }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0]).toMatchObject({
        id: 'emi:loan-1',
        kind: 'loan_emi',
        urgency: 'this_week',
        title: 'Loan EMI',
        loanId: 'loan-1',
        amount: 15900,
        dueDate: '2026-03-23T00:00:00.000Z',
        daysUntilDue: 3,
        vehicleId: 'vehicle-1',
      });
      expect(result.loans.nextEmiDate).toBe('2026-03-23T00:00:00.000Z');
      expect(result.vehicles[0]?.status).toBe('due_soon');
      expect(result.vehicles[0]?.nextDue).toBeNull();
    });

    it('(f2) keeps the instalment day inside shorter months for a loan started on the 31st', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      // Started 31 Mar 2026 with nothing paid: first instalment lands on 30 Apr, not 1 May.
      vehicleLoansService.listForUser.mockResolvedValue([
        makeLoan({ startDate: '2026-03-31T00:00:00.000Z', tenureMonths: 36, monthsRemaining: 36 }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.loans.nextEmiDate).toBe('2026-04-30T00:00:00.000Z');
      expect(result.attention).toEqual([]);
    });

    it('(g) caps the queue at 25 while counts and total reflect every item', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      remindersService.getAllReminders.mockResolvedValue(
        Array.from({ length: 30 }, (_, index) =>
          makeReminder({
            id: `reminder-${index}`,
            title: `Task ${index}`,
            dueDate: daysFromNow(2),
          }),
        ),
      );

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(25);
      expect(result.attentionTotal).toBe(30);
      expect(result.attentionCounts.thisWeek).toBe(30);
      expect(result.attentionCounts.total).toBe(30);
      expect(result.vehicles[0]?.dueSoonCount).toBe(30);
    });

    it('(g2) counts urgentVehicles from the uncapped list, past what the capped queue can show', async () => {
      // 26 vehicles, one overdue reminder each: the capped queue holds 25, so a
      // count derived from `attention` alone would undercount by one vehicle.
      vehiclesService.getAllVehicles.mockResolvedValue(
        Array.from({ length: 26 }, (_, index) => makeVehicle({ id: `vehicle-${index}` })),
      );
      remindersService.getAllReminders.mockResolvedValue(
        Array.from({ length: 26 }, (_, index) =>
          makeReminder({
            id: `reminder-${index}`,
            vehicleId: `vehicle-${index}`,
            dueDate: daysFromNow(-1),
            status: ReminderStatus.Overdue,
          }),
        ),
      );

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(25);
      expect(result.attentionCounts.urgentVehicles).toBe(26);
    });

    it('urgentVehicles excludes this_month items and de-duplicates a vehicle with several urgent rows', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([
        makeVehicle({ id: 'vehicle-1' }),
        makeVehicle({ id: 'vehicle-2' }),
      ]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({
          id: 'v1-overdue',
          vehicleId: 'vehicle-1',
          dueDate: daysFromNow(-1),
          status: ReminderStatus.Overdue,
        }),
        makeReminder({
          id: 'v1-today',
          vehicleId: 'vehicle-1',
          dueDate: daysFromNow(0),
          status: ReminderStatus.DueToday,
        }),
        makeReminder({ id: 'v2-this-month', vehicleId: 'vehicle-2', dueDate: daysFromNow(20) }),
      ]);

      const result = await service.getSummary('user-1');

      // Only vehicle-1 has an overdue/today/this_week item; vehicle-2's is this_month.
      expect(result.attentionCounts.urgentVehicles).toBe(1);
    });

    it('orders a bucket by days until due, then odometer-only items by km, then title', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle({ odometer: 12000 })]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({ id: 'km-far', title: 'B', dueDate: undefined, dueOdometer: 12900 }),
        makeReminder({ id: 'day-20-b', title: 'B', dueDate: daysFromNow(20) }),
        makeReminder({ id: 'km-near', title: 'A', dueDate: undefined, dueOdometer: 12500 }),
        makeReminder({ id: 'day-20-a', title: 'A', dueDate: daysFromNow(20) }),
        makeReminder({ id: 'day-10', title: 'Z', dueDate: daysFromNow(10) }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.attention.map((item) => item.id)).toEqual([
        'day-10',
        'day-20-a',
        'day-20-b',
        'km-near',
        'km-far',
      ]);
    });

    it('excludes a this_month document row the user snoozed', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'doc-snoozed', endDate: new Date(daysFromNow(20)) }),
      ]);
      prisma.documentDismissal.findMany.mockResolvedValue([{ documentId: 'doc-snoozed' }]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toEqual([]);
      expect(prisma.documentDismissal.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', dismissedUntil: { gt: NOW } },
        select: { documentId: true },
      });
    });

    it('still surfaces a document row once it turns overdue, even with a live snooze', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'doc-snoozed', endDate: new Date(daysFromNow(-1)) }),
      ]);
      prisma.documentDismissal.findMany.mockResolvedValue([{ documentId: 'doc-snoozed' }]);

      const result = await service.getSummary('user-1');

      expect(result.attention).toHaveLength(1);
      expect(result.attention[0]).toMatchObject({ id: 'doc-snoozed', urgency: 'overdue' });
    });

    it('does not let one snoozed document hide another, unrelated document', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'doc-snoozed', kind: 'insurance', endDate: new Date(daysFromNow(20)) }),
        makeDocument({ id: 'doc-visible', kind: 'puc', endDate: new Date(daysFromNow(3)) }),
      ]);
      prisma.documentDismissal.findMany.mockResolvedValue([{ documentId: 'doc-snoozed' }]);

      const result = await service.getSummary('user-1');

      expect(result.attention.map((item) => item.id)).toEqual(['doc-visible']);
    });
  });

  describe('vehicle health', () => {
    it('(h) sorts vehicles by severity then name and derives status, nextDue and lastService', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([
        makeVehicle({ id: 'v-alpha', nickname: 'Alpha', registrationNumber: 'AA00AA0001' }),
        makeVehicle({
          id: 'v-zulu',
          nickname: '  ',
          make: 'Tata',
          model: 'Nexon',
          registrationNumber: 'ZZ00ZZ0001',
          odometer: 30000,
          currentUserRole: VehicleRole.Viewer,
        }),
        makeVehicle({ id: 'v-bravo', nickname: 'Bravo', registrationNumber: 'BB00BB0001' }),
        makeVehicle({ id: 'v-mike', nickname: 'Mike', registrationNumber: 'MM00MM0001' }),
      ]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({
          id: 'zulu-upcoming',
          vehicleId: 'v-zulu',
          title: 'Zulu tyres',
          dueDate: daysFromNow(5),
        }),
        makeReminder({
          id: 'zulu-overdue',
          vehicleId: 'v-zulu',
          title: 'Zulu oil',
          dueDate: daysFromNow(-4),
          status: ReminderStatus.Overdue,
        }),
        makeReminder({
          id: 'mike-upcoming',
          vehicleId: 'v-mike',
          title: 'Mike service',
          dueDate: daysFromNow(3),
        }),
      ]);
      vehicleLoansService.listForUser.mockResolvedValue([
        makeLoan({ id: 'loan-alpha', vehicleId: 'v-alpha' }),
      ]);
      maintenanceService.getAllRecords.mockResolvedValue([
        makeRecord({
          id: 'zulu-latest',
          vehicleId: 'v-zulu',
          serviceDate: '2026-02-01T00:00:00.000Z',
          odometer: 28000,
          category: MaintenanceCategory.Tyres,
        }),
        makeRecord({
          id: 'zulu-older',
          vehicleId: 'v-zulu',
          serviceDate: '2025-08-01T00:00:00.000Z',
          odometer: 21000,
        }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.vehicles.map((vehicle) => vehicle.id)).toEqual([
        'v-zulu',
        'v-alpha',
        'v-mike',
        'v-bravo',
      ]);
      expect(result.vehiclesTotal).toBe(4);
      expect(result.attentionCounts.vehiclesNeedingAttention).toBe(3);

      const [zulu, alpha, mike, bravo] = result.vehicles;
      expect(zulu).toMatchObject({
        displayName: 'Tata Nexon',
        registrationNumber: 'ZZ00ZZ0001',
        odometer: 30000,
        currentUserRole: VehicleRole.Viewer,
        status: 'overdue',
        overdueCount: 1,
        dueSoonCount: 1,
        nextDue: {
          kind: 'reminder',
          targetId: 'zulu-overdue',
          title: 'Zulu oil',
          dueDate: daysFromNow(-4),
          daysUntilDue: -4,
        },
        lastService: {
          recordId: 'zulu-latest',
          serviceDate: '2026-02-01T00:00:00.000Z',
          odometer: 28000,
          category: MaintenanceCategory.Tyres,
        },
      });
      expect(alpha).toMatchObject({
        displayName: 'Alpha',
        currentUserRole: VehicleRole.Owner,
        status: 'due_soon',
        overdueCount: 0,
        dueSoonCount: 1,
        nextDue: null,
        lastService: null,
      });
      expect(mike).toMatchObject({
        status: 'due_soon',
        overdueCount: 0,
        dueSoonCount: 1,
        nextDue: { kind: 'reminder', targetId: 'mike-upcoming', daysUntilDue: 3 },
      });
      expect(bravo).toMatchObject({
        status: 'ok',
        overdueCount: 0,
        dueSoonCount: 0,
        nextDue: null,
        lastService: null,
      });
    });

    it('prefers an expiring document as nextDue when it comes before any reminder', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      remindersService.getAllReminders.mockResolvedValue([
        makeReminder({ id: 'reminder-later', dueDate: daysFromNow(6) }),
      ]);
      vehicleDocumentsService.listForUser.mockResolvedValue([
        makeDocument({ id: 'puc-1', kind: 'puc', endDate: new Date(daysFromNow(2)) }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.vehicles[0]?.nextDue).toEqual({
        kind: 'document',
        targetId: 'puc-1',
        title: 'PUC certificate',
        dueDate: daysFromNow(2),
        daysUntilDue: 2,
        dueOdometer: undefined,
      });
      expect(result.vehicles[0]?.documents.puc).toEqual({
        state: 'expiring',
        endDate: daysFromNow(2),
      });
    });

    describe('odometerUpdatedAt', () => {
      it('falls back to the vehicle updatedAt when it has no fuel logs', async () => {
        vehiclesService.getAllVehicles.mockResolvedValue([
          makeVehicle({ updatedAt: '2026-01-15T00:00:00.000Z' }),
        ]);

        const result = await service.getSummary('user-1');

        expect(result.vehicles[0]?.odometerUpdatedAt).toBe('2026-01-15T00:00:00.000Z');
        expect(prisma.fuelLog.groupBy).toHaveBeenCalledWith({
          by: ['vehicleId'],
          where: { vehicle: { members: { some: { userId: 'user-1' } } } },
          _max: { date: true },
        });
      });

      it('prefers a fuel log date more recent than the vehicle updatedAt', async () => {
        vehiclesService.getAllVehicles.mockResolvedValue([
          makeVehicle({ id: 'vehicle-1', updatedAt: '2026-01-15T00:00:00.000Z' }),
        ]);
        prisma.fuelLog.groupBy.mockResolvedValue([
          { vehicleId: 'vehicle-1', _max: { date: new Date('2026-03-10T00:00:00.000Z') } },
        ]);

        const result = await service.getSummary('user-1');

        expect(result.vehicles[0]?.odometerUpdatedAt).toBe('2026-03-10T00:00:00.000Z');
      });

      it('keeps the vehicle updatedAt when it is more recent than the latest fuel log', async () => {
        // e.g. the vehicle's nickname was edited after fuel was last logged.
        vehiclesService.getAllVehicles.mockResolvedValue([
          makeVehicle({ id: 'vehicle-1', updatedAt: '2026-03-19T00:00:00.000Z' }),
        ]);
        prisma.fuelLog.groupBy.mockResolvedValue([
          { vehicleId: 'vehicle-1', _max: { date: new Date('2026-01-01T00:00:00.000Z') } },
        ]);

        const result = await service.getSummary('user-1');

        expect(result.vehicles[0]?.odometerUpdatedAt).toBe('2026-03-19T00:00:00.000Z');
      });

      it('ignores a groupBy row with a null max date', async () => {
        vehiclesService.getAllVehicles.mockResolvedValue([
          makeVehicle({ id: 'vehicle-1', updatedAt: '2026-01-15T00:00:00.000Z' }),
        ]);
        prisma.fuelLog.groupBy.mockResolvedValue([
          { vehicleId: 'vehicle-1', _max: { date: null } },
        ]);

        const result = await service.getSummary('user-1');

        expect(result.vehicles[0]?.odometerUpdatedAt).toBe('2026-01-15T00:00:00.000Z');
      });

      it('does not cross-apply one vehicle fuel log date to another vehicle', async () => {
        vehiclesService.getAllVehicles.mockResolvedValue([
          makeVehicle({ id: 'vehicle-1', updatedAt: '2026-01-15T00:00:00.000Z' }),
          makeVehicle({ id: 'vehicle-2', updatedAt: '2026-01-20T00:00:00.000Z' }),
        ]);
        prisma.fuelLog.groupBy.mockResolvedValue([
          { vehicleId: 'vehicle-1', _max: { date: new Date('2026-03-10T00:00:00.000Z') } },
        ]);

        const result = await service.getSummary('user-1');

        const vehicle1 = result.vehicles.find((v) => v.id === 'vehicle-1');
        const vehicle2 = result.vehicles.find((v) => v.id === 'vehicle-2');
        expect(vehicle1?.odometerUpdatedAt).toBe('2026-03-10T00:00:00.000Z');
        expect(vehicle2?.odometerUpdatedAt).toBe('2026-01-20T00:00:00.000Z');
      });
    });
  });

  describe('hasSpend', () => {
    it('(i) is false with no records, fuel logs or active loans', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      vehicleLoansService.listForUser.mockResolvedValue([makeLoan({ status: LoanStatus.Closed })]);

      const result = await service.getSummary('user-1');

      expect(result.hasSpend).toBe(false);
    });

    it('(i) is true when only fuel logs exist', async () => {
      vehiclesService.getAllVehicles.mockResolvedValue([makeVehicle()]);
      prisma.fuelLog.count.mockResolvedValue(1);

      const result = await service.getSummary('user-1');

      expect(result.hasSpend).toBe(true);
    });
  });

  describe('snoozeDocumentAttention', () => {
    it('validates viewer access, upserts a 14-day dismissal and marks the notification read', async () => {
      vehicleDocumentsService.assertViewable.mockResolvedValue(makeDocument({ id: 'doc-1' }));
      // Mirrors the service's own (local-timezone) day arithmetic rather than
      // hardcoding an ISO string, which broke a date test here before.
      const expectedDismissedUntil = new Date(NOW);
      expectedDismissedUntil.setDate(expectedDismissedUntil.getDate() + 14);

      await service.snoozeDocumentAttention('user-1', 'insurance', 'doc-1');

      expect(vehicleDocumentsService.assertViewable).toHaveBeenCalledWith(
        'user-1',
        'insurance',
        'doc-1',
      );
      expect(prisma.documentDismissal.upsert).toHaveBeenCalledWith({
        where: { userId_documentId: { userId: 'user-1', documentId: 'doc-1' } },
        create: {
          userId: 'user-1',
          documentId: 'doc-1',
          documentKind: 'insurance',
          dismissedUntil: expectedDismissedUntil,
        },
        update: {
          documentKind: 'insurance',
          dismissedUntil: expectedDismissedUntil,
        },
      });
      expect(notificationsService.markReadForDocument).toHaveBeenCalledWith('user-1', 'doc-1');
    });

    it('propagates NotFoundException from the access check without touching the dismissal table', async () => {
      vehicleDocumentsService.assertViewable.mockRejectedValue(new Error('not found'));

      await expect(
        service.snoozeDocumentAttention('user-1', 'insurance', 'missing'),
      ).rejects.toThrow('not found');
      expect(prisma.documentDismissal.upsert).not.toHaveBeenCalled();
      expect(notificationsService.markReadForDocument).not.toHaveBeenCalled();
    });
  });
});
