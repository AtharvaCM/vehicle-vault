import { BadRequestException } from '@nestjs/common';
import { FuelType, ReminderType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceScheduleService } from './service-schedule.service';

describe('ServiceScheduleService', () => {
  const prisma = {
    reminder: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  const vehiclesService = { ensureVehicleExists: vi.fn() };
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };

  let service: ServiceScheduleService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.reminder.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb(prisma),
    );
    auditService.track.mockResolvedValue(undefined);
    service = new ServiceScheduleService(
      prisma as never,
      vehiclesService as never,
      auditService as never,
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
    prisma.reminder.findMany.mockResolvedValue([
      { title: 'Engine oil change', notes: null },
    ]);

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
    const firstCall = prisma.reminder.create.mock.calls[0][0].data;
    expect(firstCall.title).toBe('Engine oil change');
    expect(firstCall.dueOdometer).toBe(20000);
    expect(firstCall.type).toBe(ReminderType.Service);
    expect(firstCall.notes).toContain('[catalog:engine_oil_change]');
  });

  it('apply throws on unknown slug', async () => {
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'v1',
      odometer: 10000,
      fuelType: FuelType.Electric,
      vehicleType: VehicleType.Car,
    });

    await expect(service.applySuggestions('u1', 'v1', ['engine_oil_change'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
