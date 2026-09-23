import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MaintenanceCategory, MaintenanceRecordStatus } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

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

type ShowOptions = {
  currentOdometer?: number;
  recordId?: string;
  /** The vehicle's history, as the records query would return it. */
  history?: { id: string; serviceDate: string; odometer: number; status?: string }[];
  onDirtyChange?: (isDirty: boolean) => void;
};

function show(initialValues?: Partial<MaintenanceFormValues>, options: ShowOptions = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKeys.maintenance.list('vehicle-1'), options.history ?? []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  render(
    <MaintenanceForm
      currentOdometer={options.currentOdometer}
      initialValues={initialValues}
      onDirtyChange={options.onDirtyChange}
      onSubmit={onSubmit}
      recordId={options.recordId}
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

  it('starts a new record on today at the current reading, with the cost empty', () => {
    const onDirtyChange = vi.fn();
    show(undefined, { currentOdometer: 32_000, onDirtyChange });

    expect(screen.getByLabelText('Service date')).toHaveValue(todayDateInputValue());
    expect(screen.getByLabelText('Odometer')).toHaveValue(32_000);
    expect(screen.getByText('Current: 32,000 km')).toBeInTheDocument();
    expect(screen.getByLabelText('Total cost')).toHaveValue(null);
    // Defaults are not edits: leaving the untouched form must not prompt.
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
  });

  it('refuses a service at 0 km and an empty cost, in words', async () => {
    const onSubmit = show(undefined, { currentOdometer: 32_000 });

    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    expect(await screen.findByText('Enter the odometer reading at the service')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(screen.getByText('Enter the total cost, or 0 if it was free')).toBeInTheDocument();
    expect(screen.getByLabelText('Odometer')).toHaveAccessibleDescription(
      'Enter the odometer reading at the service',
    );
    expect(document.body).not.toHaveTextContent(/\bnan\b|expected (number|string)/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks before saving a reading lower than the last service', async () => {
    const onSubmit = show(
      { ...loaded, serviceDate: '2026-09-20', odometer: 15_000 },
      {
        history: [
          { id: 'older', serviceDate: '2026-07-25T00:00:00.000Z', odometer: 17_500 },
          {
            id: 'draft',
            serviceDate: '2026-08-01T00:00:00.000Z',
            odometer: 90_000,
            status: MaintenanceRecordStatus.Draft,
          },
        ],
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    expect(
      await screen.findByText('Lower than your last service at 17,500 km — save anyway?'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ odometer: 15_000 }));
  });

  it('does not compare a back-filled service with later ones, or a record with itself', async () => {
    const onSubmit = show(
      { ...loaded, serviceDate: '2026-07-01', odometer: 15_000 },
      {
        recordId: 'this-one',
        history: [
          { id: 'later', serviceDate: '2026-07-25T00:00:00.000Z', odometer: 17_500 },
          { id: 'this-one', serviceDate: '2026-07-01T00:00:00.000Z', odometer: 16_000 },
        ],
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/save anyway/)).not.toBeInTheDocument();
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
