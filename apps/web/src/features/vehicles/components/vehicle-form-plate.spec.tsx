import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emptyCatalogQuery = vi.hoisted(() => () => ({
  data: [],
  isLoading: false,
  error: null,
}));

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
  make: 'Tata',
  model: 'Ace',
  year: 2021,
  vehicleType: VehicleType.Truck,
  fuelType: FuelType.Diesel,
  odometer: 15_000,
};

describe('VehicleForm registration number', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('has no year or odometer preselected on a fresh vehicle', () => {
    render(<VehicleForm onSubmit={onSubmit} />);

    expect(screen.getByLabelText('Year')).toHaveValue(null);
    // A text field, grouped as it is read: empty, not zero.
    expect(screen.getByLabelText('Odometer')).toHaveValue('');
  });

  it('groups the plate as it is typed and saves it compact', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    const field = screen.getByLabelText('Registration number');
    await user.type(field, 'mh12dm0002');
    expect(field).toHaveValue('MH 12 DM 0002');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ registrationNumber: 'MH12DM0002' });
  });

  it('saves a Bharat series plate', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Registration number'), '22bh1234aa');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ registrationNumber: '22BH1234AA' });
  });

  it('saves a temporary registration, carried before the permanent plate arrives', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Registration number'), 't0724hr6123a');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ registrationNumber: 'T0724HR6123A' });
  });

  it('rejects a malformed temporary registration', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    // Three digits for month+year, not four.
    await user.type(screen.getByLabelText('Registration number'), 't072hr6123a');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() =>
      expect(screen.getByText(/valid Indian registration number/i)).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a registration that never becomes a recognised plate', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Registration number'), 'not a plate');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() =>
      expect(screen.getByText(/valid Indian registration number/i)).toBeInTheDocument(),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags a bad plate on blur, before the form is even submitted', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Registration number'), 'notaplate');
    await user.tab();

    expect(await screen.findByText(/valid Indian registration number/i)).toBeInTheDocument();
  });

  it('clears a flagged plate as soon as it is corrected, without another blur', async () => {
    const user = userEvent.setup();
    render(<VehicleForm initialValues={initialValues} onSubmit={onSubmit} />);

    const field = screen.getByLabelText('Registration number');
    await user.type(field, 'notaplate');
    await user.tab();
    expect(await screen.findByText(/valid Indian registration number/i)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'mh12dm0002');

    expect(screen.queryByText(/valid Indian registration number/i)).not.toBeInTheDocument();
  });

  it('shows a stored plate grouped and saves an edit to it compact', async () => {
    const user = userEvent.setup();
    render(
      <VehicleForm
        initialValues={{ ...initialValues, registrationNumber: 'MH12DM0002' }}
        mode="edit"
        onSubmit={onSubmit}
      />,
    );

    const field = screen.getByLabelText('Registration number');
    expect(field).toHaveValue('MH 12 DM 0002');

    await user.clear(field);
    await user.type(field, 'mh 14 ab 0003');
    fireEvent.click(screen.getByRole('button', { name: /save vehicle/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ registrationNumber: 'MH14AB0003' });
  });
});
