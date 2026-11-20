import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { computeFuelEconomy, fuelEconomyUnit } from './fuel-economy';

function fill(odometer: number, quantity: number, day: number, isFullTank?: boolean) {
  return { odometer, quantity, date: new Date(Date.UTC(2026, 8, day)), isFullTank };
}

describe('computeFuelEconomy', () => {
  it('measures between two fills: the distance, over the fuel bought at the second', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 30, 1), fill(15_450, 30, 10)],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved).toEqual({ value: 15, distanceKm: 450, quantity: 30 });
    expect(economy.usableFills).toBe(2);
  });

  it('gives no figure from a single fill, and says how many there are', () => {
    const economy = computeFuelEconomy([fill(15_000, 30, 1)], FuelType.Petrol, 17.5);

    expect(economy.achieved).toBeNull();
    expect(economy.usableFills).toBe(1);
    expect(economy.differencePercent).toBeNull();
    // The claim is still there to show.
    expect(economy.claimed).toBe(17.5);
  });

  it('compares against the catalog claim when there is one', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 30, 1), fill(15_450, 30, 10)],
      FuelType.Petrol,
      17.5,
    );

    expect(economy.claimed).toBe(17.5);
    // 15 against 17.5 is 14% short of the claim.
    expect(economy.differencePercent).toBe(-14);
  });

  it('stands alone for a vehicle with no catalog link', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 30, 1), fill(15_450, 30, 10)],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved?.value).toBe(15);
    expect(economy.claimed).toBeNull();
    expect(economy.differencePercent).toBeNull();
  });

  it('counts the fuel from a top-up at the next full fill', () => {
    // A top-up at 15,300 then a full tank at 15,900: 900 km over 10 + 50 litres.
    const economy = computeFuelEconomy(
      [fill(15_000, 40, 1), fill(15_300, 10, 5, false), fill(15_900, 50, 15)],
      FuelType.Diesel,
      null,
    );

    expect(economy.achieved).toEqual({ value: 15, distanceKm: 900, quantity: 60 });
  });

  it('measures between the first and last full fills, leaving top-ups outside them out', () => {
    // A top-up before the first full fill went into driving before measuring
    // began; one after the last is still in the tank.
    const economy = computeFuelEconomy(
      [
        fill(14_800, 10, 1, false),
        fill(15_000, 40, 2),
        fill(15_450, 30, 10),
        fill(15_600, 8, 12, false),
      ],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved).toEqual({ value: 15, distanceKm: 450, quantity: 30 });
    expect(economy.usableFills).toBe(4);
  });

  it('measures the whole run when there are not two full fills to measure between', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 20, 1, false), fill(15_300, 20, 5, false), fill(15_600, 20, 9, false)],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved).toEqual({ value: 15, distanceKm: 600, quantity: 40 });
  });

  it('orders fills by odometer, whatever order they were logged in', () => {
    const economy = computeFuelEconomy(
      [fill(15_450, 30, 10), fill(15_000, 30, 1)],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved?.value).toBe(15);
  });

  it('skips a fill that repeats a reading or has no fuel in it', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 30, 1), fill(15_000, 25, 2), fill(15_200, 0, 3), fill(15_450, 30, 10)],
      FuelType.Petrol,
      null,
    );

    expect(economy.usableFills).toBe(2);
    expect(economy.achieved?.value).toBe(15);
  });

  it('leaves out a fill whose odometer was not recorded', () => {
    const economy = computeFuelEconomy(
      [fill(0, 30, 1), fill(15_000, 30, 2), fill(15_450, 30, 10)],
      FuelType.Petrol,
      null,
    );

    expect(economy.usableFills).toBe(2);
    expect(economy.achieved?.value).toBe(15);
  });

  it('gives no figure when the only two fills share a reading', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 30, 1), fill(15_000, 30, 2)],
      FuelType.Petrol,
      null,
    );

    expect(economy.achieved).toBeNull();
    expect(economy.usableFills).toBe(1);
  });

  it('shows no claim for an electric vehicle, whose catalog figure is a range', () => {
    const economy = computeFuelEconomy(
      [fill(15_000, 20, 1), fill(15_140, 20, 5)],
      FuelType.Electric,
      452,
    );

    expect(economy.unit).toBe('km/kWh');
    expect(economy.achieved?.value).toBe(7);
    expect(economy.claimed).toBeNull();
  });
});

describe('fuelEconomyUnit', () => {
  it('follows what the vehicle runs on', () => {
    expect(fuelEconomyUnit(FuelType.Petrol)).toBe('km/L');
    expect(fuelEconomyUnit(FuelType.Diesel)).toBe('km/L');
    expect(fuelEconomyUnit(FuelType.CNG)).toBe('km/kg');
    expect(fuelEconomyUnit(FuelType.Electric)).toBe('km/kWh');
  });
});
