import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FuelLogForm } from './fuel-log-form';

const numberFields = ['Odometer (km)', 'Quantity (Litres)', 'Price per Litre', 'Total Cost'];

describe('FuelLogForm', () => {
  it('starts every number empty rather than 0', () => {
    render(<FuelLogForm onSubmit={vi.fn()} />);

    for (const label of numberFields) {
      expect(screen.getByLabelText(label)).toHaveValue(null);
    }
  });

  it('says which number is missing, never "received nan"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<FuelLogForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Save Fuel Log' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Enter the odometer reading',
      'Enter the litres',
      'Enter the price per litre',
      'Enter the amount you paid',
    ]);
    expect(document.body).not.toHaveTextContent(/\bnan\b|expected (number|string)/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('points each field at its error', async () => {
    const user = userEvent.setup();

    render(<FuelLogForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save Fuel Log' }));

    const litres = screen.getByLabelText('Quantity (Litres)');
    await screen.findByText('Enter the litres');
    expect(litres).toHaveAccessibleDescription('Enter the litres');
  });

  it('keeps what a scanned receipt filled in', () => {
    render(<FuelLogForm initialValues={{ quantity: 8, price: 105 }} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Quantity (Litres)')).toHaveValue(8);
    expect(screen.getByLabelText('Odometer (km)')).toHaveValue(null);
  });
});
