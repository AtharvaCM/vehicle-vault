import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MaintenanceCategory } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import { MaintenanceForm } from './maintenance-form';

/** A record already on file, as the edit page hands it to the form. */
const loaded: Partial<MaintenanceFormValues> = {
  entryMode: 'quick',
  serviceDate: '2026-09-20',
  odometer: 15_000,
  category: MaintenanceCategory.Other,
  currencyCode: 'INR',
  totalCost: 1_500,
  lineItems: [],
};

function show(initialValues: Partial<MaintenanceFormValues>) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  render(
    <MaintenanceForm
      initialValues={initialValues}
      onSubmit={onSubmit}
      submitLabel="Confirm Record"
      vehicleId="vehicle-1"
    />,
    { wrapper },
  );

  return onSubmit;
}

describe('MaintenanceForm', () => {
  it('saves the record it was loaded with, untouched', async () => {
    // The regression: the category the form was filled with emptied itself, and
    // pressing the button did nothing anyone could see — no save, and the
    // complaint sat under a field that looked fine.
    const onSubmit = show(loaded);

    expect(screen.getByLabelText('Category')).toHaveTextContent('Other');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: MaintenanceCategory.Other,
        odometer: 15_000,
        totalCost: 1_500,
        serviceDate: '2026-09-20T00:00:00.000Z',
      }),
    );
  });

  it('saves an edit made on top of what was loaded', async () => {
    const onSubmit = show(loaded);

    fireEvent.change(screen.getByLabelText('Total cost'), { target: { value: '2400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ totalCost: 2_400 }));
  });

  it('says what is wrong rather than saving a line item with no name', async () => {
    const onSubmit = show({
      ...loaded,
      entryMode: 'detailed',
      lineItems: [
        {
          kind: 'part',
          name: '',
          quantity: 2,
          unitPrice: 300,
          lineTotal: 600,
          unit: '',
          brand: '',
          partNumber: '',
          notes: '',
        },
      ] as MaintenanceFormValues['lineItems'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    expect(
      await screen.findByText('Item name is required for a structured entry'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the resolved qty x unit price as the line item amount, not just what was typed', async () => {
    // The bug: a line item entered as quantity x unit price counted toward the
    // record's total but its own lineTotal was only sent when typed directly,
    // so the saved item amount silently stayed null and rendered as ₹0.
    const onSubmit = show({
      ...loaded,
      entryMode: 'detailed',
      lineItems: [
        {
          kind: 'fluid',
          name: 'Engine oil',
          quantity: 3.5,
          unitPrice: 450,
          lineTotal: undefined,
          unit: 'L',
          brand: '',
          partNumber: '',
          notes: '',
        },
      ] as MaintenanceFormValues['lineItems'],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            name: 'Engine oil',
            quantity: 3.5,
            unitPrice: 450,
            lineTotal: 1575,
          }),
        ],
      }),
    );
  });
});
