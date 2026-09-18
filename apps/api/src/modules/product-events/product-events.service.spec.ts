import { describe, expect, it, vi } from 'vitest';

import { PRODUCT_EVENT_NAMES, ProductEventsService } from './product-events.service';

describe('ProductEventsService', () => {
  const client = { productEvent: { create: vi.fn(), createMany: vi.fn() } };

  describe('record', () => {
    it('writes one row through the client it is given, so it joins that transaction', () => {
      const service = new ProductEventsService({} as never);

      service.record(client as never, {
        name: 'reminder_created',
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        properties: { source: 'manual' },
      });

      expect(client.productEvent.create).toHaveBeenCalledWith({
        data: {
          name: 'reminder_created',
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          properties: { source: 'manual' },
        },
      });
    });

    it('stores an event with no vehicle or properties as nulls and an empty object', () => {
      const service = new ProductEventsService({} as never);

      service.record(client as never, { name: 'email_verified', userId: 'user-1' });

      expect(client.productEvent.create).toHaveBeenLastCalledWith({
        data: { name: 'email_verified', userId: 'user-1', vehicleId: null, properties: {} },
      });
    });
  });

  describe('recordFirst', () => {
    it('inserts with ON CONFLICT DO NOTHING, so a second "first" is a no-op, not an abort', () => {
      // The partial unique index on (userId, name) is the guard; a plain insert
      // tripping it would roll back the record the user was saving.
      const service = new ProductEventsService({} as never);

      service.recordFirst(client as never, {
        name: 'first_maintenance_logged',
        userId: 'user-1',
        vehicleId: 'vehicle-1',
      });

      expect(client.productEvent.createMany).toHaveBeenCalledWith({
        data: [
          {
            name: 'first_maintenance_logged',
            userId: 'user-1',
            vehicleId: 'vehicle-1',
            properties: {},
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('summary', () => {
    const NOW = new Date('2026-09-19T15:30:00.000Z');

    const serviceReturning = (rows: { day: Date; name: string; count: number }[]) => {
      const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
      return { service: new ProductEventsService(prisma as never), prisma };
    };

    it('covers exactly the last N UTC days, today included, with zeros filled in', async () => {
      const { service } = serviceReturning([]);

      const summary = await service.summary(3, NOW);

      expect(summary.from).toBe('2026-09-17');
      expect(summary.to).toBe('2026-09-19');
      expect(summary.series.map((entry) => entry.date)).toEqual([
        '2026-09-17',
        '2026-09-18',
        '2026-09-19',
      ]);
      for (const entry of summary.series) {
        expect(Object.keys(entry.counts).sort()).toEqual([...PRODUCT_EVENT_NAMES].sort());
        expect(Object.values(entry.counts).every((count) => count === 0)).toBe(true);
      }
    });

    it('places each count on its day and totals them', async () => {
      const { service } = serviceReturning([
        { day: new Date('2026-09-17T00:00:00.000Z'), name: 'account_created', count: 2 },
        { day: new Date('2026-09-19T00:00:00.000Z'), name: 'account_created', count: 1 },
        { day: new Date('2026-09-19T00:00:00.000Z'), name: 'vehicle_created', count: 4 },
      ]);

      const summary = await service.summary(3, NOW);

      expect(summary.series[0].counts.account_created).toBe(2);
      expect(summary.series[2].counts.account_created).toBe(1);
      expect(summary.series[2].counts.vehicle_created).toBe(4);
      expect(summary.totals.account_created).toBe(3);
      expect(summary.totals.vehicle_created).toBe(4);
    });

    it('ignores an event name this build does not know about', async () => {
      const { service } = serviceReturning([
        { day: new Date('2026-09-19T00:00:00.000Z'), name: 'something_retired', count: 9 },
      ]);

      const summary = await service.summary(1, NOW);

      expect(summary.series[0].counts).not.toHaveProperty('something_retired');
      expect(Object.values(summary.totals).every((count) => count === 0)).toBe(true);
    });

    it('asks the database only for rows from the start of the window', async () => {
      const { service, prisma } = serviceReturning([]);

      await service.summary(30, NOW);

      const [, from] = prisma.$queryRaw.mock.calls[0];
      expect(from).toEqual(new Date('2026-08-21T00:00:00.000Z'));
    });
  });
});
