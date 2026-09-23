import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { DashboardVehicleDocumentStatus } from '../types/dashboard';
import { describeVehicleDocuments } from './describe-vehicle-documents';

const today = new Date('2026-04-02T09:00:00.000Z');

const insurance: DashboardVehicleDocumentStatus = {
  state: 'active',
  endDate: '2026-12-01T00:00:00.000Z',
};
const missing: DashboardVehicleDocumentStatus = { state: 'missing', endDate: null };

describe('describeVehicleDocuments', () => {
  it('reads an electric vehicle with insurance on file as valid, not missing a PUC', () => {
    expect(
      describeVehicleDocuments({ fuelType: FuelType.Electric, documents: { insurance } }, today),
    ).toEqual({ text: 'Insurance valid · to 1 Dec 2026', tone: 'ok' });
  });

  it('still asks an electric vehicle for its insurance', () => {
    expect(
      describeVehicleDocuments(
        { fuelType: FuelType.Electric, documents: { insurance: missing } },
        today,
      ),
    ).toEqual({ text: 'No insurance on file', tone: 'warning' });
  });

  it('reports a PUC an electric vehicle has on file like any other document', () => {
    expect(
      describeVehicleDocuments(
        {
          fuelType: FuelType.Electric,
          documents: {
            insurance,
            puc: { state: 'active', endDate: '2026-09-15T00:00:00.000Z' },
          },
        },
        today,
      ).text,
    ).toBe('Insurance & PUC valid · to 15 Sep 2026');
    expect(
      describeVehicleDocuments(
        {
          fuelType: FuelType.Electric,
          documents: {
            insurance,
            puc: { state: 'expired', endDate: '2026-03-23T00:00:00.000Z' },
          },
        },
        today,
      ),
    ).toEqual({ text: 'PUC · Ended 23 Mar', tone: 'danger' });
  });

  it('asks every vehicle that burns fuel for its PUC, hybrids included', () => {
    for (const fuelType of [FuelType.Petrol, FuelType.Diesel, FuelType.CNG, FuelType.Hybrid]) {
      expect(
        describeVehicleDocuments({ fuelType, documents: { insurance, puc: missing } }, today),
      ).toEqual({ text: 'No PUC on file', tone: 'warning' });
      // A PUC the API left out altogether is just as missing.
      expect(describeVehicleDocuments({ fuelType, documents: { insurance } }, today).text).toBe(
        'No PUC on file',
      );
    }
  });

  it('asks for a PUC when an API that predates fuelType says it is missing', () => {
    // That API reports an electric vehicle's PUC as missing too; with no fuel
    // type to go on, the row keeps reading as it did before.
    expect(describeVehicleDocuments({ documents: { insurance, puc: missing } }, today)).toEqual({
      text: 'No PUC on file',
      tone: 'warning',
    });
  });
});
