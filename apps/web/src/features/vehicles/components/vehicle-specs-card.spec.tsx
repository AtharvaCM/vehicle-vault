import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useVariantSpecs = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-variant-specs', () => ({ useVariantSpecs }));

import { VehicleSpecsCard } from './vehicle-specs-card';

describe('VehicleSpecsCard', () => {
  it('explains the gap when the vehicle has no variant, instead of loading forever', () => {
    // The lookup is keyed by variant, so the query never runs and stays pending.
    useVariantSpecs.mockReturnValue({ isPending: true, isError: false, data: undefined });

    render(<VehicleSpecsCard make="Hyundai" model="Creta" />);

    expect(screen.getByText('No variant on file')).toBeInTheDocument();
    expect(
      screen.getByText(/Add the variant for your Hyundai Creta from Edit vehicle/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Looking up specifications…')).not.toBeInTheDocument();
  });

  it('looks specs up once a variant is known', () => {
    useVariantSpecs.mockReturnValue({ isPending: true, isError: false, data: undefined });

    render(<VehicleSpecsCard make="Hyundai" model="Creta" variant="SX" />);

    expect(screen.getByText('Looking up specifications…')).toBeInTheDocument();
    expect(screen.queryByText('No variant on file')).not.toBeInTheDocument();
  });
});
