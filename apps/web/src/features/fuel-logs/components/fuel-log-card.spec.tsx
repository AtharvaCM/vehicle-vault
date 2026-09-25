import { render, screen } from '@testing-library/react';
import { FuelType, type FuelLog } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { FuelLogCard } from './fuel-log-card';

const baseLog: FuelLog = {
  id: 'fuel-1',
  vehicleId: 'vehicle-1',
  date: '2026-09-01T00:00:00.000Z',
  odometer: 40_000,
  quantity: 8,
  price: 105,
  totalCost: 840,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('FuelLogCard', () => {
  it.each([
    [FuelType.Petrol, '8 L fuel fill', 'Price/L'],
    [FuelType.Diesel, '8 L fuel fill', 'Price/L'],
    [FuelType.CNG, '8 kg fuel fill', 'Price/kg'],
  ] as const)('reads as %s → "%s" (%s)', (fuelType, headline, priceLabel) => {
    render(<FuelLogCard fuelType={fuelType} log={baseLog} />);

    expect(screen.getByText(headline)).toBeInTheDocument();
    expect(screen.getByText(priceLabel)).toBeInTheDocument();
  });

  it('calls an EV charge, not a fuel fill', () => {
    render(<FuelLogCard fuelType={FuelType.Electric} log={baseLog} />);

    expect(screen.getByText('8 kWh charge')).toBeInTheDocument();
    expect(screen.getByText('Price/kWh')).toBeInTheDocument();
  });
});
