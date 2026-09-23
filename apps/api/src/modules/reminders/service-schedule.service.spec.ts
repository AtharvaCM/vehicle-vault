import { BadRequestException } from '@nestjs/common';
import { FuelType, ReminderType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceScheduleService, type CompletedReminder } from './service-schedule.service';

describe('ServiceScheduleService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  const prisma = {
    reminder: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    serviceBaseline: { findMany: vi.fn() },
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
    prisma.maintenanceRecord.findMany.mockResolvedValue([]);
    prisma.serviceBaseline.findMany.mockResolvedValue([]);
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
    expect(firstCall.notes).toBe('Whichever of the distance or the time comes first.');
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

    it('leaves every other item without history anchored to now', async () => {
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

  describe('anchoring on the last logged service', () => {
    // The demo Family SUV: engine oil logged at 17,500 km on 25-07-2026, 18,500 km now.
    const vehicle = {
      id: 'v1',
      odometer: 18_500,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.SUV,
    };
    const OIL_RECORD = {
      category: 'engine_oil',
      odometer: 17_500,
      serviceDate: new Date('2026-07-25T00:00:00.000Z'),
    };

    beforeEach(() => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(vehicle);
    });

    it('counts from the latest confirmed record and says so', async () => {
      prisma.maintenanceRecord.findMany.mockResolvedValue([OIL_RECORD]);

      const suggestions = await service.getSuggestions('u1', 'v1');
      const oil = suggestions.find((s) => s.slug === 'engine_oil_change')!;

      expect(oil.dueOdometer).toBe(27_500);
      expect(oil.dueDate?.slice(0, 10)).toBe('2027-07-25');
      expect(oil.anchor).toEqual({
        source: 'record',
        lastDoneOdometer: 17_500,
        lastDoneDate: '2026-07-25T00:00:00.000Z',
      });
    });

    it('never lets a draft anchor', async () => {
      await service.getSuggestions('u1', 'v1');

      expect(prisma.maintenanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'confirmed' }) }),
      );
    });

    it('falls back to the owner’s baseline answer', async () => {
      prisma.serviceBaseline.findMany.mockResolvedValue([
        {
          category: 'brake_pads',
          lastDoneOdometer: 12_000,
          lastDoneDate: new Date('2025-11-01T00:00:00.000Z'),
        },
      ]);

      const suggestions = await service.getSuggestions('u1', 'v1');
      const brakes = suggestions.find((s) => s.slug === 'brake_inspection')!;

      expect(brakes.dueOdometer).toBe(32_000);
      expect(brakes.dueDate?.slice(0, 10)).toBe('2027-11-01');
      expect(brakes.anchor).toMatchObject({ source: 'baseline', lastDoneOdometer: 12_000 });
    });

    it('counts the dimension a baseline does not know from now', async () => {
      prisma.serviceBaseline.findMany.mockResolvedValue([
        { category: 'air_filter', lastDoneOdometer: 10_000, lastDoneDate: null },
      ]);

      const suggestions = await service.getSuggestions('u1', 'v1');
      const filter = suggestions.find((s) => s.slug === 'air_filter')!;

      expect(filter.dueOdometer).toBe(30_000);
      expect(filter.anchor).toEqual({ source: 'baseline', lastDoneOdometer: 10_000 });
      expect(Date.parse(filter.dueDate!)).toBeGreaterThan(Date.now());
    });

    it('lets a logged service win over the baseline', async () => {
      prisma.maintenanceRecord.findMany.mockResolvedValue([OIL_RECORD]);
      prisma.serviceBaseline.findMany.mockResolvedValue([
        { category: 'engine_oil', lastDoneOdometer: 9_000, lastDoneDate: null },
      ]);

      const suggestions = await service.getSuggestions('u1', 'v1');

      expect(suggestions.find((s) => s.slug === 'engine_oil_change')?.dueOdometer).toBe(27_500);
    });

    it('says an item with no history is counted from today', async () => {
      const suggestions = await service.getSuggestions('u1', 'v1');
      const coolant = suggestions.find((s) => s.slug === 'coolant_flush')!;

      expect(coolant.dueOdometer).toBe(58_500);
      expect(coolant.anchor).toEqual({ source: 'now' });
    });

    it('creates the reminder from the same anchor the row showed', async () => {
      prisma.maintenanceRecord.findMany.mockResolvedValue([OIL_RECORD]);
      prisma.reminder.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({ id: 'rem-1', ...args.data }),
      );

      await service.applySuggestions('u1', 'v1', ['engine_oil_change']);

      const data = prisma.reminder.create.mock.calls[0][0].data;
      expect(data.dueOdometer).toBe(27_500);
      expect((data.dueDate as Date).toISOString().slice(0, 10)).toBe('2027-07-25');
    });

    it('never anchors ahead of the vehicle on a record logged past its odometer', async () => {
      prisma.maintenanceRecord.findMany.mockResolvedValue([
        { ...OIL_RECORD, odometer: 19_000, serviceDate: new Date('2099-01-01T00:00:00.000Z') },
      ]);

      const suggestions = await service.getSuggestions('u1', 'v1');
      const oil = suggestions.find((s) => s.slug === 'engine_oil_change')!;

      expect(oil.dueOdometer).toBe(28_500);
      expect(Date.parse(oil.dueDate!)).toBeLessThan(Date.parse('2099-01-01T00:00:00.000Z'));
    });
  });

  describe('two-wheelers', () => {
    const bike = {
      id: 'v1',
      odometer: 12_000,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Motorcycle,
      catalogVariantId: null,
    };

    it('takes intervals from the two-wheeler table and drops what does not apply', async () => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(bike);
      // What the resolver answers for a scooter with no drive or cooling on file.
      intervalResolver.resolveForVehicle.mockResolvedValue({
        periodic_service: { km: 3000, months: 6, source: 'default' },
        engine_oil: { km: 3000, months: 4, source: 'default' },
        air_filter: { km: 8000, months: 12, source: 'default' },
        brake_pads: { km: 10000, months: 12, source: 'default' },
      });

      const suggestions = await service.getSuggestions('u1', 'v1');
      const slugs = suggestions.map((s) => s.slug);
      const oil = suggestions.find((s) => s.slug === 'engine_oil_change')!;

      expect(intervalResolver.resolveForVehicle).toHaveBeenCalled();
      expect(oil).toMatchObject({ intervalKm: 3000, intervalMonths: 4, dueOdometer: 15_000 });
      expect(slugs).not.toContain('tyre_rotation');
      expect(slugs).not.toContain('coolant_flush');
      expect(slugs).not.toContain('chain_lube');
      // Measured, not serviced, so it has no category and still applies.
      expect(slugs).toContain('tyre_inspection');
      // No spark plug or CVT belt in the resolver's answer, so neither is offered.
      expect(slugs).not.toContain('spark_plug');
      expect(slugs).not.toContain('cvt_belt');
    });

    it('offers a CVT scooter its spark plug and belt at the two-wheeler intervals', async () => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(bike);
      intervalResolver.resolveForVehicle.mockResolvedValue({
        spark_plug: { km: 9000, months: null, source: 'default' },
        cvt_belt: { km: 24000, months: null, source: 'default' },
      });

      const suggestions = await service.getSuggestions('u1', 'v1');

      expect(suggestions.find((s) => s.slug === 'spark_plug')).toMatchObject({
        intervalKm: 9000,
        dueOdometer: 21_000,
      });
      expect(suggestions.find((s) => s.slug === 'cvt_belt')).toMatchObject({
        intervalKm: 24000,
        dueOdometer: 36_000,
      });
    });

    it('leaves an unlinked car on the curated catalog', async () => {
      vehiclesService.ensureVehicleExists.mockResolvedValue({
        ...bike,
        vehicleType: VehicleType.Car,
      });

      const suggestions = await service.getSuggestions('u1', 'v1');

      expect(intervalResolver.resolveForVehicle).not.toHaveBeenCalled();
      expect(suggestions.find((s) => s.slug === 'engine_oil_change')?.intervalKm).toBe(10_000);
      expect(suggestions.map((s) => s.slug)).toContain('tyre_rotation');
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

    it('counts a completed service reminder from its completion, not an older record', async () => {
      // Ticking the reminder off says the oil was changed now; the record from
      // 10,000 km ago would make the successor born due.
      prisma.maintenanceRecord.findMany.mockResolvedValue([
        { category: 'engine_oil', odometer: 30_000, serviceDate: new Date('2025-09-01') },
      ]);

      await expect(service.buildNextOccurrence('u1', completed(), now)).resolves.toMatchObject({
        dueOdometer: 50_000,
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
