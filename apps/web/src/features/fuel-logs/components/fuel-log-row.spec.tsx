import { render, screen } from '@testing-library/react';
import { FuelType, type FuelLog } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { FuelLogList } from './fuel-log-list';

function fill(id: string, odometer: number, quantity: number, day: number): FuelLog {
  const date = `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  return {
    id,
    vehicleId: 'vehicle-1',
    date,
    odometer,
    quantity,
    price: 105,
    totalCost: quantity * 100,
    createdAt: date,
    updatedAt: date,
  };
}

describe('FuelLogList', () => {
  it('lists each fill with its quantity, reading, amount and economy since the fill before', () => {
    render(
      <FuelLogList
        fuelType={FuelType.Petrol}
        logs={[fill('b', 10_300, 20, 4), fill('a', 10_000, 25, 1)]}
      />,
    );

    const rows = screen.getAllByTestId('fuel-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('20 L');
    expect(rows[0]).toHaveTextContent('10,300 km');
    expect(rows[0]).toHaveTextContent('₹2,000');
    expect(rows[0]).toHaveTextContent('15.0 km/L');
    // The first fill has nothing before it to measure against.
    expect(rows[1]).not.toHaveTextContent('km/L');
  });

  it.each([
    [FuelType.CNG, '20 kg', '15.0 km/kg'],
    [FuelType.Electric, '20 kWh', '15.0 km/kWh'],
  ] as const)('measures a %s vehicle in its own unit', (fuelType, quantity, economy) => {
    render(
      <FuelLogList
        fuelType={fuelType}
        logs={[fill('b', 10_300, 20, 4), fill('a', 10_000, 25, 1)]}
      />,
    );

    const [latest] = screen.getAllByTestId('fuel-row');
    expect(latest).toHaveTextContent(quantity);
    expect(latest).toHaveTextContent(economy);
  });
});
