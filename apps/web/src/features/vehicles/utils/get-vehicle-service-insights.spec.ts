import { FuelType, MaintenanceCategory, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { getVehicleServiceInsights } from './get-vehicle-service-insights';

const vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Honda',
  model: 'City',
  variant: 'VX',
  year: 2022,
  fuelType: FuelType.Petrol,
  odometer: 18200,
  vehicleType: VehicleType.Car,
  nickname: 'Daily driver',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
};

const records = [
  {
    id: 'record-1',
    vehicleId: vehicle.id,
    serviceDate: '2026-01-15T00:00:00.000Z',
    odometer: 12000,
    category: MaintenanceCategory.EngineOil,
    workshopName: 'Torque Garage',
    totalCost: 3000,
    notes: '',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'record-2',
    vehicleId: vehicle.id,
    serviceDate: '2026-02-20T00:00:00.000Z',
    odometer: 15000,
    category: MaintenanceCategory.PeriodicService,
    workshopName: 'Torque Garage',
    totalCost: 4200,
    nextDueDate: '2026-04-01T00:00:00.000Z',
    nextDueOdometer: 20000,
    notes: '',
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-02-20T00:00:00.000Z',
  },
];

describe('getVehicleServiceInsights', () => {
  it('derives odometer and service trend metrics from maintenance history', () => {
    const insights = getVehicleServiceInsights({
      vehicle,
      records,
      now: new Date('2026-03-22T00:00:00.000Z'),
    });

    expect(insights.averageKmBetweenServices).toBe(3000);
    expect(insights.averageDaysBetweenServices).toBe(36);
    expect(insights.averageSpend).toBe(3600);
    expect(insights.kmSinceLastService).toBe(3200);
    expect(insights.nextDueOdometerDelta).toBe(1800);
    expect(insights.nextDueDateDeltaDays).toBe(10);
    expect(insights.history[0]).toMatchObject({
      kind: 'current',
      odometer: 18200,
    });
    expect(insights.history[1]).toMatchObject({
      id: 'record-2',
      kind: 'service',
      odometer: 15000,
    });
  });

  it('handles vehicles without maintenance records', () => {
    const insights = getVehicleServiceInsights({
      vehicle,
      records: [],
      now: new Date('2026-03-22T00:00:00.000Z'),
    });

    expect(insights.averageKmBetweenServices).toBeNull();
    expect(insights.averageDaysBetweenServices).toBeNull();
    expect(insights.averageSpend).toBeNull();
    expect(insights.kmSinceLastService).toBeNull();
    expect(insights.latestService).toBeNull();
    expect(insights.history).toHaveLength(1);
    expect(insights.history[0]).toMatchObject({
      kind: 'current',
      odometer: vehicle.odometer,
    });
  });
});
