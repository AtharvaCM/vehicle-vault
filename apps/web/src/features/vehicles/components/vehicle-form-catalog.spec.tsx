import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type CatalogParams = { vehicleType: VehicleType; make?: string; model?: string };

/**
 * A small India catalog as the API answers it per type: the Creta is filed
 * under SUV only, and Jeep exists only as an SUV make.
 */
const catalog = vi.hoisted(() => ({
  makes: {
    car: [{ id: 'hyundai-car', name: 'Hyundai' }],
    suv: [
      { id: 'hyundai-suv', name: 'Hyundai' },
      { id: 'jeep', name: 'Jeep' },
    ],
  } as Record<string, Array<{ id: string; name: string }>>,
  models: {
    'car|Hyundai': [
      { id: 'i20', name: 'i20' },
      { id: 'verna', name: 'Verna' },
    ],
    'suv|Hyundai': [{ id: 'creta', name: 'Creta' }],
  } as Record<string, Array<{ id: string; name: string }>>,
  variants: {
    'suv|Hyundai|Creta': [
      { id: 'creta-sx', name: 'SX', fuelTypes: ['petrol'], isCurrent: true, yearStart: 2020 },
    ],
  } as Record<string, unknown[]>,
}));

const answer = (data: unknown[] | undefined, enabled: boolean) => ({
  data: enabled ? (data ?? []) : undefined,
  isLoading: false,
  error: null,
});

vi.mock('../hooks/use-vehicle-catalog-makes', () => ({
  useVehicleCatalogMakes: (params: CatalogParams, enabled = true) =>
    answer(catalog.makes[params.vehicleType], enabled),
}));
vi.mock('../hooks/use-vehicle-catalog-models', () => ({
  useVehicleCatalogModels: (params: CatalogParams, enabled = true) =>
    answer(catalog.models[`${params.vehicleType}|${params.make}`], enabled),
}));
vi.mock('../hooks/use-vehicle-catalog-variants', () => ({
  useVehicleCatalogVariants: (params: CatalogParams, enabled = true) =>
    answer(catalog.variants[`${params.vehicleType}|${params.make}|${params.model}`], enabled),
}));

import { VehicleForm } from './vehicle-form';

beforeAll(() => {
  // cmdk measures and scrolls its list; jsdom does neither.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
});

const newCar = {
  registrationNumber: 'MH12AB1234',
  year: 2024,
  vehicleType: VehicleType.Car,
  fuelType: FuelType.Petrol,
  odometer: 1_200,
};

async function pick(id: string, search: string, option: string | RegExp) {
  await userEvent.click(document.getElementById(id)!);
  const list = await screen.findByRole('listbox');
  // The popover's own search box (cmdk renders it as a combobox too).
  await userEvent.type(document.querySelector<HTMLInputElement>('[cmdk-input]')!, search);
  await userEvent.click(within(list).getByRole('option', { name: option }));
}

describe('VehicleForm catalog pickers', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('finds a model the catalog files under SUV while the type is Car, and takes its type', async () => {
    render(<VehicleForm initialValues={newCar} onSubmit={onSubmit} />);

    await pick('vehicle-make', 'Hyun', 'Hyundai');
    await pick('vehicle-model', 'creta', /Creta · listed under SUV/);

    expect(screen.getByLabelText('Vehicle type')).toHaveTextContent('SUV');
    expect(screen.getByLabelText('Make')).toHaveTextContent('Hyundai');
    expect(screen.getByLabelText('Model')).toHaveTextContent('Creta');

    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      vehicleType: VehicleType.SUV,
      make: 'Hyundai',
      model: 'Creta',
    });
  });

  it('lists makes from both Car and SUV', async () => {
    render(<VehicleForm initialValues={newCar} onSubmit={onSubmit} />);

    await userEvent.click(document.getElementById('vehicle-make')!);
    const list = await screen.findByRole('listbox');

    expect(within(list).getByRole('option', { name: 'Jeep' })).toBeInTheDocument();
    expect(within(list).getAllByRole('option', { name: 'Hyundai' })).toHaveLength(1);
  });

  it('enters a make the catalog lacks by hand, and saves it with the chosen type', async () => {
    render(<VehicleForm initialValues={newCar} onSubmit={onSubmit} />);

    await pick('vehicle-make', 'Ather', `Can't find it? Enter "Ather" manually`);

    // The make and every field after it are now free text.
    expect(screen.getByLabelText('Make')).toHaveValue('Ather');
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: '450X' } });
    fireEvent.change(screen.getByLabelText('Variant (optional)'), { target: { value: 'Pro' } });
    expect(screen.getByText(/You are entering the make, model and variant by hand/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      vehicleType: VehicleType.Car,
      make: 'Ather',
      model: '450X',
      variant: 'Pro',
    });
  });

  it('enters only the model by hand, keeping the make from the catalog', async () => {
    render(<VehicleForm initialValues={newCar} onSubmit={onSubmit} />);

    await pick('vehicle-make', 'Hyun', 'Hyundai');
    await pick('vehicle-model', 'Alcazar', `Can't find it? Enter "Alcazar" manually`);

    expect(screen.getByLabelText('Make')).toHaveTextContent('Hyundai');
    expect(screen.getByLabelText('Model')).toHaveValue('Alcazar');

    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      vehicleType: VehicleType.Car,
      make: 'Hyundai',
      model: 'Alcazar',
    });
  });

  it('goes back to the catalog on request', async () => {
    render(<VehicleForm initialValues={newCar} onSubmit={onSubmit} />);

    await pick('vehicle-make', 'Ather', `Can't find it? Enter "Ather" manually`);
    await userEvent.click(screen.getByRole('button', { name: 'Choose from the catalog instead' }));

    expect(screen.getByLabelText('Make')).toHaveAttribute('role', 'combobox');
    expect(screen.getByLabelText('Make')).toHaveTextContent('Select make');
  });
});
