import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { summarizeMaintenanceHistory } from './summarize-maintenance-history';

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    serviceDate: '2026-01-10T00:00:00.000Z',
    odometer: 9_000,
    category: MaintenanceCategory.EngineOil,
    totalCost: 3_000,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('summarizeMaintenanceHistory', () => {
  it('counts confirmed records only, and reports drafts on their own', () => {
    const summary = summarizeMaintenanceHistory([
      makeRecord({ id: 'a', status: MaintenanceRecordStatus.Confirmed }),
      // A record without a status is a confirmed record.
      makeRecord({
        id: 'b',
        vehicleId: 'vehicle-2',
        serviceDate: '2026-02-01T00:00:00.000Z',
        totalCost: 1_500,
      }),
      // A draft on a third vehicle, dated today and carrying what the scan read.
      makeRecord({
        id: 'c',
        vehicleId: 'vehicle-3',
        serviceDate: '2026-03-20T00:00:00.000Z',
        totalCost: 9_999,
        status: MaintenanceRecordStatus.Draft,
      }),
    ]);

    expect(summary).toEqual({
      recordCount: 2,
      draftCount: 1,
      vehiclesWithHistory: 2,
      totalSpend: 4_500,
      latestServiceDate: '2026-02-01T00:00:00.000Z',
    });
  });

  it('has no spend or latest service while every record is a draft', () => {
    expect(
      summarizeMaintenanceHistory([makeRecord({ status: MaintenanceRecordStatus.Draft })]),
    ).toEqual({
      recordCount: 0,
      draftCount: 1,
      vehiclesWithHistory: 0,
      totalSpend: 0,
      latestServiceDate: null,
    });
  });
});
