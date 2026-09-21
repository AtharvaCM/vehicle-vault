import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emptyCatalogQuery = vi.hoisted(() => () => ({
  data: [],
  isLoading: false,
  error: null,
}));

// A truck is outside the catalog, so the form renders plain inputs and these
// hooks stay disabled; stubbing them keeps the test off the query client.
vi.mock('../hooks/use-vehicle-catalog-makes', () => ({
  useVehicleCatalogMakes: emptyCatalogQuery,
}));
vi.mock('../hooks/use-vehicle-catalog-models', () => ({
  useVehicleCatalogModels: emptyCatalogQuery,
}));
vi.mock('../hooks/use-vehicle-catalog-variants', () => ({
  useVehicleCatalogVariants: emptyCatalogQuery,
}));

import { VehicleForm } from './vehicle-form';

const initialValues = {
  registrationNumber: 'MH12AB1234',
  make: 'Tata',
  model: 'Ace',
  year: 2021,
  vehicleType: VehicleType.Truck,
  fuelType: FuelType.Diesel,
  odometer: 15_000,
};

describe('VehicleForm variant', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('calls the variant optional, so nobody hunts for their trim to get started', () => {
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    expect(screen.getByText('Variant (optional)')).toBeInTheDocument();
  });

  it('saves a vehicle with the variant left blank', async () => {
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0]?.[0];
    // Absent rather than an empty string: the API stores nothing for it.
    expect(values.variant).toBeUndefined();
    expect(values).toMatchObject({ make: 'Tata', model: 'Ace' });
  });

  it('keeps a variant that was filled in', async () => {
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Variant (optional)'), { target: { value: ' HT ' } });
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0].variant).toBe('HT');
  });
});
