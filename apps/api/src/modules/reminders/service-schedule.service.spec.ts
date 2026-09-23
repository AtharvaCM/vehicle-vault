import { BadRequestException } from '@nestjs/common';
import { FuelType, ReminderType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceScheduleService, type CompletedReminder } from './service-schedule.service';

describe('ServiceScheduleService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  const prisma = {
    reminder: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  };
  const vehiclesService = { ensureVehicleExists: vi.fn() };
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };
  const intervalResolver = { resolveForVehicle: vi.fn() };
  const tyresService = { getAlertState: vi.fn() };

  /** No tyres tracked, so the walk-around falls back to the current odometer. */
  const noTyreObservation = (vehicleOdometer = 0) => ({
    vehicleOdometer,
    conditions: [],
    lastObservation: null,
  });

  let service: ServiceScheduleService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.reminder.findMany.mockResolvedValue([]);
    prisma.reminder.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb(prisma),
    );
    auditService.track.mockResolvedValue(undefined);
    intervalResolver.resolveForVehicle.mockResolvedValue({});
    tyresService.getAlertState.mockResolvedValue(noTyreObservation());
    service = new ServiceScheduleService(
      prisma as never,
      vehiclesService as never,
      auditService as never,
      { assert: vi.fn(), assertEditor: vi.fn(), assertOwner: vi.fn(), resolve: vi.fn() } as never,
      intervalResolver as never,
      tyresService as never,
      productEvents as never,
    );
  });

  it('filters out non-applicable items for an EV', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 8000,
      fuelType: FuelType.Electric,
      vehicleType: VehicleType.Car,
    });

    const suggestions = await service.getSuggestions('u1', 'v1');
    const slugs = suggestions.map((s) => s.slug);

    expect(slugs).toContain('ev_battery_health');
    expect(slugs).toContain('tyre_rotation');
    expect(slugs).toContain('insurance_renewal');
    expect(slugs).not.toContain('engine_oil_change');
    expect(slugs).not.toContain('puc_renewal');
    expect(slugs).not.toContain('chain_lube');
  });

  it('computes dueOdometer from current odometer and intervalKm', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 25000,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    });

    const suggestions = await service.getSuggestions('u1', 'v1');
    const oil = suggestions.find((s) => s.slug === 'engine_oil_change');
    expect(oil?.dueOdometer).toBe(35000);
    expect(oil?.intervalMonths).toBe(12);
    expect(oil?.dueDate).toBeDefined();
  });

  it('flags alreadyScheduled when matching reminder exists', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 0,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    });
    prisma.reminder.findMany.mockResolvedValue([{ title: 'Engine oil change', catalogSlug: null }]);

    const suggestions = await service.getSuggestions('u1', 'v1');
    const oil = suggestions.find((s) => s.slug === 'engine_oil_change')!;
    const tyre = suggestions.find((s) => s.slug === 'tyre_rotation')!;
    expect(oil.alreadyScheduled).toBe(true);
    expect(tyre.alreadyScheduled).toBe(false);
  });

  it('apply creates reminders for the requested slugs', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 10000,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    });
    prisma.reminder.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'rem-' + args.data.title,
      ...args.data,
    }));

    const result = await service.applySuggestions('u1', 'v1', [
      'engine_oil_change',
      'tyre_rotation',
    ]);

    expect(result.created).toHaveLength(2);
    expect(prisma.reminder.create).toHaveBeenCalledTimes(2);
    expect(auditService.track).toHaveBeenCalledTimes(2);
    expect(productEvents.record).toHaveBeenCalledTimes(2);
    expect(productEvents.record).toHaveBeenCalledWith(expect.anything(), {
      name: 'reminder_created',
      userId: 'u1',
      vehicleId: 'v1',
      properties: { source: 'schedule' },
    });
    const firstCall = prisma.reminder.create.mock.calls[0][0].data;
    expect(firstCall.title).toBe('Engine oil change');
    expect(firstCall.dueOdometer).toBe(20000);
    expect(firstCall.type).toBe(ReminderType.Service);
    // Origin and cadence are columns; the notes are the item's own words.
    expect(firstCall.notes).toBe(
      'Recommended every 10 000 km or 12 months, whichever comes first.',
    );
    expect(firstCall).toMatchObject({
      catalogSlug: 'engine_oil_change',
      repeatEveryKm: 10000,
      repeatEveryMonths: 12,
    });
    expect(prisma.reminder.create.mock.calls[1][0].data).toMatchObject({
      catalogSlug: 'tyre_rotation',
      repeatEveryKm: 10000,
      repeatEveryMonths: null,
    });
  });

  it('flags alreadyScheduled from the catalog origin column', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 0,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    });
    prisma.reminder.findMany.mockResolvedValue([
      { title: 'My own oil reminder', catalogSlug: 'engine_oil_change' },
    ]);

    const suggestions = await service.getSuggestions('u1', 'v1');

    expect(suggestions.find((s) => s.slug === 'engine_oil_change')?.alreadyScheduled).toBe(true);
  });

  describe('tyre walk-around anchoring', () => {
    const vehicle = {
      id: 'v1',
      odometer: 40_000,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    };

    beforeEach(() => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(vehicle);
    });

    it('counts the interval from the last time anyone actually looked', async () => {
      // Measured 4 000 km ago on a 5 000 km interval: due in 1 000 km, not 5 000.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2026-08-01T00:00:00.000Z'), odometer: 36_000 },
      });

      const suggestions = await service.getSuggestions('u1', 'v1');
      const check = suggestions.find((s) => s.slug === 'tyre_inspection')!;

      expect(check.dueOdometer).toBe(41_000);
    });

    it('falls back to the current odometer when nothing has ever been measured', async () => {
      const suggestions = await service.getSuggestions('u1', 'v1');

      expect(suggestions.find((s) => s.slug === 'tyre_inspection')?.dueOdometer).toBe(45_000);
    });

    it('leaves every other item anchored to now', async () => {
      // The anchor is per-slug: a stale tyre reading must not drag the oil
      // change forward with it.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2026-08-01T00:00:00.000Z'), odometer: 36_000 },
      });

      const suggestions = await service.getSuggestions('u1', 'v1');

      expect(suggestions.find((s) => s.slug === 'engine_oil_change')?.dueOdometer).toBe(50_000);
    });

    it('never anchors ahead of the vehicle, however odd the reading', async () => {
      // An observation logged at an odometer the vehicle has not reached would
      // otherwise push the next check beyond a full interval away.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2027-01-01T00:00:00.000Z'), odometer: 90_000 },
      });

      const suggestions = await service.getSuggestions('u1', 'v1');
      const check = suggestions.find((s) => s.slug === 'tyre_inspection')!;

      expect(check.dueOdometer).toBe(45_000);
      expect(Date.parse(check.dueDate!)).toBeLessThan(Date.parse('2027-06-01T00:00:00.000Z'));
    });

    it('applies the same anchor it previewed', async () => {
      // Otherwise the reminder created is not the one the user was shown.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2026-08-01T00:00:00.000Z'), odometer: 36_000 },
      });
      prisma.reminder.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({ id: 'rem-1', ...args.data }),
      );

      await service.applySuggestions('u1', 'v1', ['tyre_inspection']);

      expect(prisma.reminder.create.mock.calls[0][0].data.dueOdometer).toBe(41_000);
    });
  });

  describe('buildNextOccurrence', () => {
    const vehicle = {
      id: 'v1',
      odometer: 40_000,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    };
    const now = new Date('2026-09-08T00:00:00.000Z');

    /** A completed reminder as the reminders service hands it over. */
    function completed(overrides: Partial<CompletedReminder> = {}): CompletedReminder {
      return {
        id: 'rem-current',
        vehicleId: 'v1',
        title: 'Engine oil change',
        type: ReminderType.Service,
        notes: 'Recommended every 10 000 km or 12 months, whichever comes first.',
        dueDate: null,
        catalogSlug: 'engine_oil_change',
        repeatEveryKm: 10_000,
        repeatEveryMonths: 12,
        ...overrides,
      } as CompletedReminder;
    }

    beforeEach(() => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(vehicle);
      tyresService.getAlertState.mockResolvedValue(noTyreObservation(40_000));
    });

    describe('a schedule reminder (regression: keeps repeating as before)', () => {
      it('schedules the next occurrence with its origin, rule and notes', async () => {
        const next = await service.buildNextOccurrence('u1', completed(), now);

        expect(next).toMatchObject({
          vehicleId: 'v1',
          title: 'Engine oil change',
          dueOdometer: 50_000,
          dueDate: new Date('2027-09-08T00:00:00.000Z'),
          catalogSlug: 'engine_oil_change',
          repeatEveryKm: 10_000,
          repeatEveryMonths: 12,
          notes: 'Recommended every 10 000 km or 12 months, whichever comes first.',
        });
      });

      it('stops when the item no longer applies to the vehicle', async () => {
        vehiclesService.ensureVehicleExists.mockResolvedValue({
          ...vehicle,
          fuelType: FuelType.Electric,
        });

        await expect(service.buildNextOccurrence('u1', completed(), now)).resolves.toBeNull();
      });

      it('stops when another open reminder already covers the item, never counting itself', async () => {
        prisma.reminder.count.mockResolvedValue(1);

        await expect(service.buildNextOccurrence('u1', completed(), now)).resolves.toBeNull();
        // Completion has not committed when this runs, so the row is still
        // open: without excluding it the chain would end at the first completion.
        expect(prisma.reminder.count).toHaveBeenCalledWith({
          where: expect.objectContaining({
            catalogSlug: 'engine_oil_change',
            id: { not: 'rem-current' },
          }),
        });
      });

      it('stops when the owner turned its repeat rule off', async () => {
        await expect(
          service.buildNextOccurrence(
            'u1',
            completed({ repeatEveryKm: null, repeatEveryMonths: null }),
            now,
          ),
        ).resolves.toBeNull();
      });

      it('schedules nothing when the tyre walk-around anchor has not moved on', async () => {
        // Ticked off without a measurement: the last observation is 15 000 km
        // back, so the next occurrence would be born overdue on both limits.
        tyresService.getAlertState.mockResolvedValue({
          vehicleOdometer: 40_000,
          conditions: [],
          lastObservation: { at: new Date('2025-01-01T00:00:00.000Z'), odometer: 25_000 },
        });

        await expect(
          service.buildNextOccurrence(
            'u1',
            completed({
              title: 'Tyre tread & pressure check',
              type: ReminderType.Inspection,
              catalogSlug: 'tyre_inspection',
              repeatEveryKm: 5_000,
              repeatEveryMonths: 6,
            }),
            now,
          ),
        ).resolves.toBeNull();
      });

      it('still schedules when only the date has passed but the distance has not', async () => {
        tyresService.getAlertState.mockResolvedValue({
          vehicleOdometer: 40_000,
          conditions: [],
          lastObservation: { at: new Date('2025-01-01T00:00:00.000Z'), odometer: 39_000 },
        });

        await expect(
          service.buildNextOccurrence(
            'u1',
            completed({
              catalogSlug: 'tyre_inspection',
              type: ReminderType.Inspection,
              repeatEveryKm: 5_000,
              repeatEveryMonths: 6,
            }),
            now,
          ),
        ).resolves.toMatchObject({ dueOdometer: 44_000 });
      });
    });

    describe('a hand-written reminder', () => {
      const handWritten = (overrides: Partial<CompletedReminder> = {}) =>
        completed({ catalogSlug: null, notes: 'Ask about the rattle', ...overrides });

      it('does not repeat without a rule', async () => {
        await expect(
          service.buildNextOccurrence(
            'u1',
            handWritten({ repeatEveryKm: null, repeatEveryMonths: null }),
            now,
          ),
        ).resolves.toBeNull();
      });

      it('repeats by date, counted from completion', async () => {
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({ repeatEveryKm: null, repeatEveryMonths: 6 }),
          now,
        );

        expect(next).toMatchObject({
          dueDate: new Date('2027-03-08T00:00:00.000Z'),
          dueOdometer: null,
          catalogSlug: null,
          repeatEveryMonths: 6,
          notes: 'Ask about the rattle',
        });
        // No catalog lookups for a reminder the schedule did not make.
        expect(prisma.reminder.count).not.toHaveBeenCalled();
        expect(tyresService.getAlertState).not.toHaveBeenCalled();
      });

      it('repeats by distance, counted from the odometer at completion', async () => {
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({ repeatEveryKm: 7_500, repeatEveryMonths: null }),
          now,
        );

        expect(next).toMatchObject({ dueOdometer: 47_500, dueDate: null });
      });

      it('carries both limits when both are set: whichever comes first', async () => {
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({ repeatEveryKm: 10_000, repeatEveryMonths: 12 }),
          now,
        );

        expect(next).toMatchObject({
          dueOdometer: 50_000,
          dueDate: new Date('2027-09-08T00:00:00.000Z'),
        });
      });

      it('keeps a renewal on its cycle when it is renewed early', async () => {
        // Insurance due 1 Oct, renewed on 8 Sept: next year's policy still
        // runs out on 1 Oct, not a few weeks sooner.
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({
            title: 'Insurance renewal',
            type: ReminderType.Insurance,
            dueDate: new Date('2026-10-01T00:00:00.000Z'),
            repeatEveryKm: null,
            repeatEveryMonths: 12,
          }),
          now,
        );

        expect(next?.dueDate).toEqual(new Date('2027-10-01T00:00:00.000Z'));
      });

      it('counts a late renewal from when it was done', async () => {
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({
            type: ReminderType.Puc,
            dueDate: new Date('2026-08-01T00:00:00.000Z'),
            repeatEveryKm: null,
            repeatEveryMonths: 6,
          }),
          now,
        );

        expect(next?.dueDate).toEqual(new Date('2027-03-08T00:00:00.000Z'));
      });

      it('counts a service from completion even when it was done early', async () => {
        const next = await service.buildNextOccurrence(
          'u1',
          handWritten({
            dueDate: new Date('2026-12-01T00:00:00.000Z'),
            repeatEveryKm: null,
            repeatEveryMonths: 12,
          }),
          now,
        );

        expect(next?.dueDate).toEqual(new Date('2027-09-08T00:00:00.000Z'));
      });
    });
  });

  it('apply throws on unknown slug', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 10000,
      fuelType: FuelType.Electric,
      vehicleType: VehicleType.Car,
    });

    await expect(
      service.applySuggestions('u1', 'v1', ['engine_oil_change']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
