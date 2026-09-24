import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';
import { MaintenanceCategory, MaintenanceRecordStatus } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { encodeHistoryCursor, historyMonth, HistoryService } from './history.service';

type Mock = ReturnType<typeof vi.fn>;

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

/** A UUID whose last group is `n`, so ids sort by `n`. */
function uuid(n: number) {
  return `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;
}

function service(
  n: number,
  serviceDate: string,
  overrides: Partial<{
    vehicleId: string;
    status: MaintenanceRecordStatus;
    totalCost: string;
    workshopName: string | null;
  }> = {},
) {
  return {
    id: uuid(n),
    vehicleId: overrides.vehicleId ?? V1,
    serviceDate: new Date(serviceDate),
    category: MaintenanceCategory.EngineOil,
    status: overrides.status ?? MaintenanceRecordStatus.Confirmed,
    workshopName: overrides.workshopName === undefined ? 'City Hyundai' : overrides.workshopName,
    odometer: 17500,
    totalCost: new Prisma.Decimal(overrides.totalCost ?? '4200.00'),
    currencyCode: 'INR',
  };
}

function fuel(n: number, date: string, totalCost = '3000.00', vehicleId = V1) {
  return {
    id: uuid(n),
    vehicleId,
    date: new Date(date),
    quantity: 30.5,
    location: 'HP, Baner',
    odometer: 18000,
    totalCost: new Prisma.Decimal(totalCost),
  };
}

function reading(n: number, occurredAt: string, before: unknown, after: unknown, vehicleId = V1) {
  return { id: uuid(n), resourceId: vehicleId, occurredAt: new Date(occurredAt), before, after };
}

function makePrisma() {
  return {
    maintenanceRecord: { findMany: vi.fn(), count: vi.fn() },
    fuelLog: { findMany: vi.fn() },
    auditEvent: { findMany: vi.fn() },
  };
}

describe('historyMonth', () => {
  it('reads the month on the Indian calendar', () => {
    // 20:30 UTC on 30 Sep is 02:00 on 1 Oct in India.
    expect(historyMonth(new Date('2026-09-30T20:30:00.000Z'))).toBe('2026-10');
    expect(historyMonth(new Date('2026-09-30T00:00:00.000Z'))).toBe('2026-09');
  });
});

describe('HistoryService.list', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let access: { listAccessibleVehicleIds: Mock };
  let history: HistoryService;

  /** The page's own reads, then the month-total reads, in call order. */
  function stubSources({
    services = [],
    fuels = [],
    readings = [],
    drafts = 0,
    monthServices = [],
    monthFuels = [],
  }: {
    services?: unknown[];
    fuels?: unknown[];
    readings?: unknown[];
    drafts?: number;
    monthServices?: unknown[];
    monthFuels?: unknown[];
  }) {
    prisma.maintenanceRecord.findMany
      .mockResolvedValueOnce(services)
      .mockResolvedValueOnce(monthServices);
    prisma.fuelLog.findMany.mockResolvedValueOnce(fuels).mockResolvedValueOnce(monthFuels);
    prisma.auditEvent.findMany.mockResolvedValueOnce(readings);
    prisma.maintenanceRecord.count.mockResolvedValueOnce(drafts);
  }

  beforeEach(() => {
    prisma = makePrisma();
    access = { listAccessibleVehicleIds: vi.fn().mockResolvedValue([V1, V2]) };
    history = new HistoryService(prisma as never, access as never);
  });

  it('merges service, fuel and odometer entries newest first', async () => {
    stubSources({
      services: [service(1, '2026-09-10T00:00:00.000Z')],
      fuels: [fuel(2, '2026-09-20T00:00:00.000Z')],
      readings: [reading(3, '2026-09-15T06:00:00.000Z', { odometer: 17900 }, { odometer: 18000 })],
    });

    const page = await history.list('user-1', {});

    expect(page.entries.map((entry) => entry.kind)).toEqual(['fuel', 'odometer', 'service']);
    expect(page.entries[1]).toMatchObject({
      kind: 'odometer',
      vehicleId: V1,
      odometer: 18000,
      previousOdometer: 17900,
      month: '2026-09',
    });
    expect(page.entries[2]).toMatchObject({
      kind: 'service',
      totalCost: '4200.00',
      workshopName: 'City Hyundai',
      status: MaintenanceRecordStatus.Confirmed,
    });
    expect(page.nextCursor).toBeNull();
  });

  it('reads odometer changes from vehicle update events on the vehicles the user can see', async () => {
    stubSources({});

    await history.list('user-1', {});

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resourceType: AuditResourceType.vehicle,
          resourceId: { in: [V1, V2] },
          action: 'vehicle.updated',
          changedFields: { has: 'odometer' },
        },
      }),
    );
  });

  it('lists drafts marked, counts them, and keeps them out of month totals', async () => {
    stubSources({
      services: [
        service(1, '2026-09-10T00:00:00.000Z', { status: MaintenanceRecordStatus.Draft }),
        service(2, '2026-09-05T00:00:00.000Z'),
      ],
      drafts: 1,
      monthServices: [
        {
          serviceDate: new Date('2026-09-10T00:00:00.000Z'),
          totalCost: new Prisma.Decimal('9999.00'),
          status: MaintenanceRecordStatus.Draft,
        },
        {
          serviceDate: new Date('2026-09-05T00:00:00.000Z'),
          totalCost: new Prisma.Decimal('4200.00'),
          status: MaintenanceRecordStatus.Confirmed,
        },
      ],
      monthFuels: [
        { date: new Date('2026-09-12T00:00:00.000Z'), totalCost: new Prisma.Decimal('1500.50') },
      ],
    });

    const page = await history.list('user-1', {});

    expect(page.entries[0]).toMatchObject({
      kind: 'service',
      status: MaintenanceRecordStatus.Draft,
    });
    expect(page.draftCount).toBe(1);
    expect(page.months).toEqual([{ month: '2026-09', total: '5700.50', draftCount: 1 }]);
  });

  it('totals each month over the whole month, not just the rows on the page', async () => {
    stubSources({
      fuels: [fuel(1, '2026-09-20T00:00:00.000Z'), fuel(2, '2026-08-02T00:00:00.000Z')],
      monthServices: [],
      monthFuels: [
        { date: new Date('2026-09-20T00:00:00.000Z'), totalCost: new Prisma.Decimal('3000.00') },
        { date: new Date('2026-09-01T00:00:00.000Z'), totalCost: new Prisma.Decimal('2000.00') },
        { date: new Date('2026-08-02T00:00:00.000Z'), totalCost: new Prisma.Decimal('3000.00') },
      ],
    });

    const page = await history.list('user-1', {});

    expect(page.months).toEqual([
      { month: '2026-09', total: '5000.00', draftCount: 0 },
      { month: '2026-08', total: '3000.00', draftCount: 0 },
    ]);
    // Bounded by the Indian calendar: 1 Aug 00:00 IST to 1 Oct 00:00 IST.
    expect(prisma.fuelLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          vehicleId: { in: [V1, V2] },
          date: {
            gte: new Date('2026-07-31T18:30:00.000Z'),
            lt: new Date('2026-09-30T18:30:00.000Z'),
          },
        },
      }),
    );
  });

  it('gives no total to a month with only odometer readings', async () => {
    stubSources({
      readings: [reading(1, '2026-09-15T06:00:00.000Z', { odometer: 1 }, { odometer: 2 })],
    });

    const page = await history.list('user-1', {});

    expect(page.months).toEqual([{ month: '2026-09', total: null, draftCount: 0 }]);
  });

  it('pages with a cursor that resumes after the last entry', async () => {
    stubSources({
      services: [service(3, '2026-09-10T00:00:00.000Z'), service(1, '2026-09-01T00:00:00.000Z')],
      fuels: [fuel(2, '2026-09-10T00:00:00.000Z')],
    });

    const page = await history.list('user-1', { limit: 2 });

    // Same day: the higher id comes first.
    expect(page.entries.map((entry) => entry.id)).toEqual([uuid(3), uuid(2)]);
    expect(page.nextCursor).toBe(
      encodeHistoryCursor({ at: new Date('2026-09-10T00:00:00.000Z'), id: uuid(2) }),
    );
    expect(prisma.fuelLog.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 3 }),
    );

    stubSources({ services: [service(1, '2026-09-01T00:00:00.000Z')] });
    const next = await history.list('user-1', { limit: 2, cursor: page.nextCursor! });

    expect(next.entries.map((entry) => entry.id)).toEqual([uuid(1)]);
    expect(next.nextCursor).toBeNull();
    expect(prisma.maintenanceRecord.findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          vehicleId: { in: [V1, V2] },
          OR: [
            { serviceDate: { lt: new Date('2026-09-10T00:00:00.000Z') } },
            { serviceDate: new Date('2026-09-10T00:00:00.000Z'), id: { lt: uuid(2) } },
          ],
        },
      }),
    );
  });

  it('skips a reading whose payload was anonymised but still pages past it', async () => {
    stubSources({
      readings: [
        reading(
          2,
          '2026-09-15T06:00:00.000Z',
          { odometer: '[redacted]' },
          { odometer: '[redacted]' },
        ),
        reading(1, '2026-09-14T06:00:00.000Z', null, { odometer: 5000 }),
      ],
    });

    const page = await history.list('user-1', { limit: 1 });

    expect(page.entries).toEqual([]);
    expect(page.nextCursor).not.toBeNull();
  });

  it('reads only the kind asked for', async () => {
    prisma.fuelLog.findMany.mockResolvedValueOnce([fuel(1, '2026-09-20T00:00:00.000Z')]);
    prisma.fuelLog.findMany.mockResolvedValueOnce([]);

    const page = await history.list('user-1', { kind: 'fuel', vehicleId: V2 });

    expect(prisma.maintenanceRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.maintenanceRecord.count).not.toHaveBeenCalled();
    expect(prisma.fuelLog.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { vehicleId: { in: [V2] } } }),
    );
    expect(page.draftCount).toBe(0);
    expect(page.months).toEqual([{ month: '2026-09', total: null, draftCount: 0 }]);
  });

  it('refuses a vehicle the user cannot see', async () => {
    await expect(
      history.list('user-1', { vehicleId: '33333333-3333-4333-8333-333333333333' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a cursor it did not make', async () => {
    await expect(history.list('user-1', { cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns an empty page for a user with no vehicles', async () => {
    access.listAccessibleVehicleIds.mockResolvedValue([]);

    await expect(history.list('user-1', {})).resolves.toEqual({
      entries: [],
      months: [],
      draftCount: 0,
      nextCursor: null,
    });
    expect(prisma.fuelLog.findMany).not.toHaveBeenCalled();
  });
});
