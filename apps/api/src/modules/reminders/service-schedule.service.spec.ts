import { BadRequestException } from '@nestjs/common';
import { FuelType, ReminderType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceScheduleService } from './service-schedule.service';

describe('ServiceScheduleService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  const prisma = {
    reminder: { findMany: vi.fn(), create: vi.fn() },
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
    prisma.reminder.findMany.mockResolvedValue([{ title: 'Engine oil change', notes: null }]);

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
    expect(firstCall.notes).toContain('[catalog:engine_oil_change]');
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

    beforeEach(() => {
      vehiclesService.ensureVehicleExists.mockResolvedValue(vehicle);
      tyresService.getAlertState.mockResolvedValue(noTyreObservation(40_000));
    });

    it('schedules the next occurrence of a catalog reminder', async () => {
      const next = await service.buildNextOccurrence('u1', 'v1', 'engine_oil_change', now);

      expect(next).toMatchObject({
        vehicleId: 'v1',
        title: 'Engine oil change',
        dueOdometer: 50_000,
      });
      expect(next?.notes).toContain('[catalog:engine_oil_change]');
    });

    it('does not turn a hand-written reminder into a repeating one', async () => {
      // No marker means the user never stated an interval, so there is nothing
      // to repeat and inventing one would be putting words in their mouth.
      await expect(service.buildNextOccurrence('u1', 'v1', null, now)).resolves.toBeNull();
    });

    it('stops when the item no longer applies to the vehicle', async () => {
      vehiclesService.ensureVehicleExists.mockResolvedValue({
        ...vehicle,
        fuelType: FuelType.Electric,
      });

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'engine_oil_change', now),
      ).resolves.toBeNull();
    });

    it('stops when something already covers the slug', async () => {
      prisma.reminder.findMany.mockResolvedValue([
        { notes: 'whatever\n[catalog:engine_oil_change]' },
      ]);

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'engine_oil_change', now),
      ).resolves.toBeNull();
    });

    it('does not mistake the reminder being completed for its own successor', async () => {
      // Completion has not committed when this runs, so the row is still
      // active. Without excluding it the duplicate check matches itself and the
      // chain silently ends at the first completion — which is exactly what
      // happened the first time this ran against a real database.
      prisma.reminder.findMany.mockImplementation(
        async (args: { where: { id?: { not?: string } } }) =>
          args.where.id?.not === 'rem-current' ? [] : [{ notes: '[catalog:engine_oil_change]' }],
      );

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'engine_oil_change', now, 'rem-current'),
      ).resolves.toMatchObject({ dueOdometer: 50_000 });
    });

    it('schedules nothing when the anchor has not moved on', async () => {
      // Walk-around ticked off without a measurement being logged: the last
      // observation is 15 000 km back, so the next occurrence would be born
      // 10 000 km overdue and completing it would make another.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2025-01-01T00:00:00.000Z'), odometer: 25_000 },
      });

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'tyre_inspection', now),
      ).resolves.toBeNull();
    });

    it('still schedules when only the date has passed but the distance has not', async () => {
      // Two limits, and reaching one of them is not reaching both.
      tyresService.getAlertState.mockResolvedValue({
        vehicleOdometer: 40_000,
        conditions: [],
        lastObservation: { at: new Date('2025-01-01T00:00:00.000Z'), odometer: 39_000 },
      });

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'tyre_inspection', now),
      ).resolves.toMatchObject({ dueOdometer: 44_000 });
    });

    it('is not confused by an active reminder for a different item', async () => {
      prisma.reminder.findMany.mockResolvedValue([{ notes: '[catalog:tyre_rotation]' }]);

      await expect(
        service.buildNextOccurrence('u1', 'v1', 'engine_oil_change', now),
      ).resolves.not.toBeNull();
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
