import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { VehicleFormValues } from '../schemas/vehicle-form.schema';
import { buildVehicleUpdatePayload } from './build-vehicle-update-payload';

const values: VehicleFormValues = {
  registrationNumber: 'MH12AB1234',
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX',
  year: 2022,
  vehicleType: VehicleType.Car,
  fuelType: FuelType.Petrol,
  odometer: 12_000,
  nickname: 'Highway cruiser',
  catalogVariantId: 'catalog-variant-1',
  purchaseDate: '2022-01-01T00:00:00.000Z',
  purchasePrice: 850_000,
  purchaseOdometer: 10,
};

describe('buildVehicleUpdatePayload', () => {
  it('sends only the fields react-hook-form marked dirty', () => {
    const payload = buildVehicleUpdatePayload(values, { nickname: true });

    expect(payload).toEqual({ nickname: 'Highway cruiser' });
  });

  it('leaves purchase details out when only the nickname changed', () => {
    const payload = buildVehicleUpdatePayload(values, { nickname: true });

    expect(payload).not.toHaveProperty('purchaseDate');
    expect(payload).not.toHaveProperty('purchasePrice');
    expect(payload).not.toHaveProperty('purchaseOdometer');
  });

  it('sends the purchase fields the owner actually touched', () => {
    const payload = buildVehicleUpdatePayload(values, {
      purchasePrice: true,
      purchaseOdometer: true,
    });

    expect(payload).toEqual({ purchasePrice: 850_000, purchaseOdometer: 10 });
  });

  it('carries the catalog link along with a variant-only change', () => {
    const payload = buildVehicleUpdatePayload(values, { variant: true });

    expect(payload).toEqual({ variant: 'SX', catalogVariantId: 'catalog-variant-1' });
  });

  it('carries the catalog link along when make, model, year, type or fuel change', () => {
    const payload = buildVehicleUpdatePayload(values, { model: true });

    expect(payload).toEqual({ model: 'Creta', catalogVariantId: 'catalog-variant-1' });
  });

  it('sends nothing when nothing is dirty', () => {
    const payload = buildVehicleUpdatePayload(values, {});

    expect(payload).toEqual({});
  });
});
