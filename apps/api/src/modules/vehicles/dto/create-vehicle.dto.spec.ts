import { ValidationPipe } from '@nestjs/common';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { CreateVehicleDto } from './create-vehicle.dto';
import { UpdateVehicleDto } from './update-vehicle.dto';

/** Mirrors the global pipe configured in `main.ts`. */
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const metadata = { type: 'body' as const, metatype: CreateVehicleDto };

const transform = (body: unknown) => pipe.transform(body, metadata);

const vehicle = {
  registrationNumber: 'MH12AB1234',
  make: 'Honda',
  model: 'City',
  year: 2024,
  vehicleType: VehicleType.Car,
  fuelType: FuelType.Petrol,
  odometer: 0,
};

describe('CreateVehicleDto fromCatalogIntent', () => {
  it('accepts a vehicle without it', async () => {
    expect((await transform(vehicle)).fromCatalogIntent).toBeUndefined();
  });

  it('accepts true', async () => {
    await expect(transform({ ...vehicle, fromCatalogIntent: true })).resolves.toMatchObject({
      fromCatalogIntent: true,
    });
  });

  // Implicit conversion would read any non-empty string as `true`.
  it.each([false, 'true', 'false', 1, 'yes'])('rejects %j', async (value) => {
    await expect(transform({ ...vehicle, fromCatalogIntent: value })).rejects.toThrow();
  });
});

// One plate, one spelling: the per-owner unique index compares the stored text.
describe('CreateVehicleDto registrationNumber', () => {
  it.each([
    ['MH 12 AB 1234', 'MH12AB1234'],
    ['mh-12-ab-1234', 'MH12AB1234'],
    [' 22 bh 1234 aa ', '22BH1234AA'],
    ['MH12AB1234', 'MH12AB1234'],
  ])('stores %j as %j', async (typed, stored) => {
    await expect(transform({ ...vehicle, registrationNumber: typed })).resolves.toMatchObject({
      registrationNumber: stored,
    });
  });

  it('rejects one with nothing left once compacted', async () => {
    await expect(transform({ ...vehicle, registrationNumber: ' - ' })).rejects.toThrow();
  });

  it('compacts an edited one too', async () => {
    await expect(
      pipe.transform(
        { registrationNumber: 'mh 12 ab 1234' },
        { type: 'body', metatype: UpdateVehicleDto },
      ),
    ).resolves.toEqual({ registrationNumber: 'MH12AB1234' });
  });
});
