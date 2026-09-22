import { render, screen } from '@testing-library/react';
import type { VehicleFuelEconomy } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const economyQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../hooks/use-vehicle-fuel-economy', () => ({
  useVehicleFuelEconomy: () => economyQuery.current,
}));

import { FuelEconomyCard } from './fuel-economy-card';

function given(economy: Partial<VehicleFuelEconomy>) {
  economyQuery.current = {
    isPending: false,
    isError: false,
    data: {
      unit: 'km/L',
      usableFills: 2,
      achieved: null,
      claimed: null,
      differencePercent: null,
      ...economy,
    },
  };
}

describe('FuelEconomyCard', () => {
  beforeEach(() => {
    economyQuery.current = {};
  });

  it('sets the real figure from two fills beside the claim, with the gap', () => {
    given({
      achieved: { value: 15, distanceKm: 450, quantity: 30 },
      claimed: 17.5,
      differencePercent: -14,
    });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText('15.0')).toBeInTheDocument();
    expect(screen.getByText('Real, over 450 km and 30 L')).toBeInTheDocument();
    expect(screen.getByText(/Claimed 17\.5 km\/L/)).toBeInTheDocument();
    expect(screen.getByText('14% below the claim')).toBeInTheDocument();
  });

  it('says what is missing after a single fill instead of showing a number', () => {
    given({ usableFills: 1, claimed: 17.5 });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/One fill-up logged/)).toBeInTheDocument();
    expect(screen.queryByText(/Real, over/)).not.toBeInTheDocument();
    // The claim is still worth knowing while the first interval is driven.
    expect(screen.getByText(/Claimed 17\.5 km\/L/)).toBeInTheDocument();
  });

  it('asks for fill-ups when there are none', () => {
    given({ usableFills: 0 });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/No fill-ups with an odometer reading yet/)).toBeInTheDocument();
  });

  it('shows the real figure on its own for a vehicle with no catalog link', () => {
    given({ achieved: { value: 15, distanceKm: 450, quantity: 30 } });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText('15.0')).toBeInTheDocument();
    expect(screen.queryByText(/Claimed/)).not.toBeInTheDocument();
  });

  it('says so when the vehicle beats its claim', () => {
    given({
      achieved: { value: 18.6, distanceKm: 930, quantity: 50 },
      claimed: 17.5,
      differencePercent: 6,
    });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText('6% above the claim')).toBeInTheDocument();
  });

  it('measures CNG by the kilogram', () => {
    given({ unit: 'km/kg', achieved: { value: 24.2, distanceKm: 242, quantity: 10 } });

    render(<FuelEconomyCard vehicleId="vehicle-1" />);

    expect(screen.getByText('km/kg')).toBeInTheDocument();
    expect(screen.getByText('Real, over 242 km and 10 kg')).toBeInTheDocument();
  });
});
