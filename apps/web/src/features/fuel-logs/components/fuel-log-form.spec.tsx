import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { FuelLogForm } from './fuel-log-form';

const frontFields = ['Amount paid', 'Quantity (L)', 'Odometer (km)'];

describe('FuelLogForm', () => {
  it('starts every number empty rather than 0', () => {
    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={vi.fn()} />);

    for (const label of frontFields) {
      expect(screen.getByLabelText(label)).toHaveValue(null);
    }
  });

  it('puts only the three required fields up front, with the rest under More details', () => {
    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={vi.fn()} />);

    for (const label of frontFields) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.queryByLabelText('Station')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'More details' })).toBeInTheDocument();
  });

  it('defaults full tank on for a liquid fuel, with the toggle up front', () => {
    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Full tank' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('has no full tank toggle for an electric vehicle, and calls it a charge', () => {
    render(<FuelLogForm fuelType={FuelType.Electric} onSubmit={vi.fn()} />);

    expect(screen.queryByRole('switch', { name: 'Full tank' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quantity (kWh)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save charge' })).toBeInTheDocument();
  });

  it('takes its quantity unit from the fuel type', () => {
    const { rerender } = render(<FuelLogForm fuelType={FuelType.Diesel} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Quantity (L)')).toBeInTheDocument();

    rerender(<FuelLogForm fuelType={FuelType.CNG} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Quantity (kg)')).toBeInTheDocument();
  });

  it('says which number is missing, never "received nan"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Save fuel' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Enter the amount you paid',
      'Enter the quantity',
      'Enter the odometer reading',
    ]);
    expect(document.body).not.toHaveTextContent(/\bnan\b|expected (number|string)/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('points each field at its error', async () => {
    const user = userEvent.setup();

    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save fuel' }));

    const quantity = screen.getByLabelText('Quantity (L)');
    await screen.findByText('Enter the quantity');
    expect(quantity).toHaveAccessibleDescription('Enter the quantity');
  });

  it('shows the last reading as a hint under Odometer, without filling it in', () => {
    render(<FuelLogForm fuelType={FuelType.Petrol} lastOdometer={40_230} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(null);
    expect(screen.getByText('Last reading: 40,230 km')).toBeInTheDocument();
  });

  it('keeps what a scanned receipt filled in', () => {
    render(
      <FuelLogForm
        fuelType={FuelType.Petrol}
        initialValues={{ quantity: 8, price: 105 }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Quantity (L)')).toHaveValue(8);
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(null);
  });

  it('computes price per unit from amount ÷ quantity, under More details', async () => {
    const user = userEvent.setup();
    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText('Amount paid'), '840');
    await user.type(screen.getByLabelText('Quantity (L)'), '8');
    await user.click(screen.getByRole('button', { name: 'More details' }));

    expect(await screen.findByLabelText('Price per L')).toHaveValue(105);
  });

  it('submits the full-tank flag for a liquid fuel and omits it for an EV', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FuelLogForm fuelType={FuelType.Petrol} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Amount paid'), '840');
    await user.type(screen.getByLabelText('Quantity (L)'), '8');
    await user.type(screen.getByLabelText('Odometer (km)'), '40500');
    await user.click(screen.getByRole('button', { name: 'Save fuel' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ isFullTank: true }));
  });
});
