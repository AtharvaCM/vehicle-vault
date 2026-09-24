import { fireEvent, render, screen } from '@testing-library/react';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type CatalogParams = { year?: number };

/**
 * The Creta SX, on sale from 2020 to 2022. The variant list answers per year,
 * and can be held back to stand in for a slow network.
 */
const catalog = vi.hoisted(() => ({ variantsLoading: false }));

vi.mock('../hooks/use-vehicle-catalog-makes', () => ({
  useVehicleCatalogMakes: () => ({
    data: [{ id: 'hyundai', name: 'Hyundai' }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../hooks/use-vehicle-catalog-models', () => ({
  useVehicleCatalogModels: () => ({
    data: [{ id: 'creta', name: 'Creta' }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../hooks/use-vehicle-catalog-variants', () => ({
  useVehicleCatalogVariants: ({ year }: CatalogParams, enabled = true) => {
    const onSale = year !== undefined && year >= 2020 && year <= 2022;
    const loading = enabled && catalog.variantsLoading;

    return {
      data:
        enabled && !loading
          ? onSale
            ? [
                {
                  id: 'creta-sx',
                  name: 'SX',
                  fuelTypes: ['petrol'],
                  yearStart: 2020,
                  yearEnd: 2022,
                },
              ]
            : []
          : undefined,
      isLoading: loading,
      error: null,
    };
  },
}));

import { VehicleForm } from './vehicle-form';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// A prefilled vehicle, as "Track this vehicle" opens the form.
const prefilled = {
  year: 2022,
  vehicleType: VehicleType.SUV,
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX',
  fuelType: FuelType.Petrol,
};

function changeYear(year: number) {
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: String(year) } });
}

describe('VehicleForm year change', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    catalog.variantsLoading = false;
  });

  it('keeps the variant for another year it was sold in', () => {
    render(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    changeYear(2020);

    expect(screen.getByLabelText('Model')).toHaveTextContent('Creta');
    expect(screen.getByLabelText('Variant (optional)')).toHaveTextContent('SX');
  });

  it('starts the pickers over for a year the variant was not sold in', () => {
    render(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    changeYear(2024);

    expect(screen.getByLabelText('Make')).toHaveTextContent('Select make');
    expect(screen.getByLabelText('Variant (optional)')).toHaveTextContent('Select model first');
  });

  it('keeps a prefilled variant when the year changes before its list has loaded', () => {
    catalog.variantsLoading = true;
    const { rerender } = render(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    changeYear(2020);
    expect(screen.getByLabelText('Model')).toHaveTextContent('Creta');

    catalog.variantsLoading = false;
    rerender(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    expect(screen.getByLabelText('Model')).toHaveTextContent('Creta');
    expect(screen.getByLabelText('Variant (optional)')).toHaveTextContent('SX');
  });

  it('lets the new year decide, once its list arrives, for a variant whose years were not known', () => {
    catalog.variantsLoading = true;
    const { rerender } = render(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    changeYear(2024);
    catalog.variantsLoading = false;
    rerender(<VehicleForm initialValues={prefilled} onSubmit={onSubmit} />);

    expect(screen.getByLabelText('Make')).toHaveTextContent('Select make');
    expect(screen.getByLabelText('Variant (optional)')).toHaveTextContent('Select model first');
  });
});
