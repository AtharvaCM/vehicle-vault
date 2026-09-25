import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  type VehicleServiceIntervalMap,
} from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';
import { todayDateInputValue } from '@/lib/utils/to-date-input-value';

import type { MaintenanceFormValues } from '../schemas/maintenance-form.schema';
import type { BillField } from '../utils/get-fields-from-bill';
import type { CategoryPick } from '../utils/pick-due-category';
import { MaintenanceForm } from './maintenance-form';

/** A record already on file, as the edit page hands it to the form. */
const loaded: Partial<MaintenanceFormValues> = {
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
  history?: {
    id: string;
    serviceDate: string;
    odometer: number;
    status?: string;
    category?: MaintenanceCategory;
  }[];
  onDirtyChange?: (isDirty: boolean) => void;
  fieldsFromBill?: ReadonlySet<BillField>;
  intervals?: VehicleServiceIntervalMap;
  workshops?: string[];
  suggestedCategory?: CategoryPick | null;
  scheduleNextDue?: boolean;
};

function show(initialValues?: Partial<MaintenanceFormValues>, options: ShowOptions = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    queryKeys.maintenance.list('vehicle-1'),
    (options.history ?? []).map((record) => ({ category: MaintenanceCategory.Other, ...record })),
  );
  client.setQueryData(queryKeys.vehicles.intervals('vehicle-1'), options.intervals ?? {});
  client.setQueryData(queryKeys.maintenance.workshops(), options.workshops ?? []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  render(
    <MaintenanceForm
      currentOdometer={options.currentOdometer}
      fieldsFromBill={options.fieldsFromBill}
      initialValues={initialValues}
      onDirtyChange={options.onDirtyChange}
      onSubmit={onSubmit}
      recordId={options.recordId}
      scheduleNextDue={options.scheduleNextDue}
      submitLabel="Confirm Record"
      suggestedCategory={options.suggestedCategory}
      vehicleId="vehicle-1"
    />,
    { wrapper },
  );

  return onSubmit;
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm Record' }));
const chip = (name: string) => screen.getByRole('button', { name, pressed: true });

describe('MaintenanceForm', () => {
  it('saves the record it was loaded with, untouched', async () => {
    // The regression: the category the form was filled with emptied itself, and
    // pressing the button did nothing anyone could see — no save, and the
    // complaint sat under a field that looked fine.
    const onSubmit = show(loaded);

    expect(chip('Other')).toBeInTheDocument();
    save();

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

  it('is one short form: no entry-mode toggle, no tips, the extras collapsed', () => {
    show(undefined, { currentOdometer: 32_000 });

    expect(screen.queryByText(/quick entry|detailed entry|common tasks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/smart suggestions|how totals work/i)).not.toBeInTheDocument();
    for (const extra of [/^Workshop/, /^Parts and labour/, /^Notes/]) {
      expect(screen.getByRole('button', { name: extra })).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByLabelText('Workshop or garage')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Record' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('saves an edit made on top of what was loaded', async () => {
    const onSubmit = show(loaded);

    fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '2400' } });
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ totalCost: 2_400 }));
  });

  it('groups the total the Indian way as it is typed', async () => {
    const onSubmit = show(loaded);
    const total = screen.getByLabelText('Total on the bill');

    expect(total).toHaveValue('1,500');
    fireEvent.change(total, { target: { value: '131624' } });
    expect(total).toHaveValue('1,31,624');
    fireEvent.change(total, { target: { value: '1,31,624.5' } });
    expect(total).toHaveValue('1,31,624.5');
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ totalCost: 131_624.5 }));
  });

  it('picks what was done with one tap', async () => {
    const onSubmit = show(loaded);

    fireEvent.click(screen.getByRole('button', { name: 'Oil change' }));
    expect(chip('Oil change')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Other' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wheel alignment' }));
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ category: MaintenanceCategory.WheelAlignment }),
    );
  });

  it('starts on the service that is due, and says why', () => {
    show(undefined, {
      currentOdometer: 32_000,
      suggestedCategory: {
        category: MaintenanceCategory.EngineOil,
        reason: 'Picked because the oil change is due today.',
      },
    });

    expect(chip('Oil change')).toBeInTheDocument();
    expect(screen.getByText('Picked because the oil change is due today.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Brakes' }));
    expect(screen.queryByText(/Picked because/)).not.toBeInTheDocument();
  });

  it('keeps a loaded record on its own category, not the suggestion', () => {
    show(loaded, {
      suggestedCategory: { category: MaintenanceCategory.EngineOil, reason: 'Picked because.' },
    });

    expect(chip('Other')).toBeInTheDocument();
    expect(screen.queryByText('Picked because.')).not.toBeInTheDocument();
  });

  it('says what is wrong rather than saving a line item with no name', async () => {
    const onSubmit = show({
      ...loaded,
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

    save();

    // The collapsed extra opens to show it.
    expect(
      await screen.findByText('Item name is required for a structured entry'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('starts a new record on today at the current reading, with the total empty', () => {
    const onDirtyChange = vi.fn();
    show(undefined, { currentOdometer: 32_000, onDirtyChange });

    expect(screen.getByLabelText('Date')).toHaveValue(todayDateInputValue());
    expect(screen.getByLabelText('Odometer')).toHaveValue(32_000);
    expect(
      screen.getByText(
        'Today, and the last reading you saved. Change them if the visit was earlier.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Total on the bill')).toHaveValue('');
    // Defaults are not edits: leaving the untouched form must not prompt.
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);

    // Still the defaults after the total is typed; not once the reading changes.
    fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '900' } });
    expect(screen.getByText(/^Today, and the last reading you saved/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '32100' } });
    expect(screen.getByText('Last saved reading: 32,000 km.')).toBeInTheDocument();
  });

  it('refuses a service at 0 km and an empty total, in words', async () => {
    const onSubmit = show(undefined, { currentOdometer: 32_000 });

    fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '0' } });
    save();

    expect(await screen.findByText('Enter the odometer reading at the service')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(
      screen.getByText('Enter the total on the bill, or 0 if it was free'),
    ).toBeInTheDocument();
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

    save();

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

    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/save anyway/)).not.toBeInTheDocument();
  });

  it('marks each value read from the bill until it is edited', () => {
    show(
      { ...loaded, workshopName: 'Torque Garage' },
      { fieldsFromBill: new Set<BillField>(['odometer', 'totalCost', 'workshopName']) },
    );

    // The workshop's marker shows on its collapsed row, with the name.
    expect(screen.getAllByText('from bill')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /^Workshop/ })).toHaveTextContent('Torque Garage');

    fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '2400' } });

    expect(screen.getAllByText('from bill')).toHaveLength(2);
  });

  it('offers the workshops used before', async () => {
    const onSubmit = show(loaded, { workshops: ['Sai Motors', 'Torque Garage'] });

    fireEvent.click(screen.getByRole('button', { name: /^Workshop/ }));
    fireEvent.change(screen.getByLabelText('Workshop or garage'), { target: { value: 'tor' } });
    expect(screen.queryByRole('button', { name: 'Sai Motors' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Torque Garage' }));

    expect(screen.getByLabelText('Workshop or garage')).toHaveValue('Torque Garage');
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ workshopName: 'Torque Garage' }),
    );
  });

  it('sends the resolved qty x unit price as the line item amount, not just what was typed', async () => {
    // The bug: a line item entered as quantity x unit price counted toward the
    // record's total but its own lineTotal was only sent when typed directly,
    // so the saved item amount silently stayed null and rendered as ₹0.
    const onSubmit = show({
      ...loaded,
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

    expect(screen.getByRole('button', { name: /^Parts and labour/ })).toHaveTextContent(
      '1 item · ₹1,575',
    );
    save();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCost: 1575,
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

  describe('next due', () => {
    const oilChange = {
      currentOdometer: 32_000,
      scheduleNextDue: true,
      intervals: {
        [MaintenanceCategory.EngineOil]: { km: 10_000, months: 12, source: 'default' as const },
      },
      suggestedCategory: { category: MaintenanceCategory.EngineOil, reason: '' },
    };

    it('is worked out from the schedule before saving, and saved as shown', async () => {
      const onSubmit = show(undefined, oilChange);

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-23' } });
      fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '1800' } });

      expect(screen.getByTestId('next-due')).toHaveTextContent(
        "Next oil change42,000 km or 23 Sep 2027, whichever first. We'll remind you.",
      );
      save();

      // Exactly what the API makes the reminder from (see next-due-reminder.ts).
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          category: MaintenanceCategory.EngineOil,
          nextDueOdometer: 42_000,
          nextDueDate: '2027-09-23T00:00:00.000Z',
        }),
      );
    });

    it('follows the work picked and the reading typed', () => {
      show(undefined, oilChange);

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-23' } });
      fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '33000' } });
      expect(screen.getByTestId('next-due')).toHaveTextContent('43,000 km or 23 Sep 2027');

      fireEvent.click(screen.getByRole('button', { name: 'Battery' }));
      expect(screen.getByTestId('next-due')).toHaveTextContent('No schedule for this work.');
    });

    it('can be changed to what the workshop said', async () => {
      const onSubmit = show(undefined, oilChange);

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-23' } });
      fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '1800' } });
      fireEvent.click(screen.getByRole('button', { name: 'Change' }));
      expect(screen.getByLabelText('Next due odometer')).toHaveValue(42_000);
      fireEvent.change(screen.getByLabelText('Next due odometer'), { target: { value: '40000' } });
      save();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          nextDueOdometer: 40_000,
          nextDueDate: '2027-09-23T00:00:00.000Z',
        }),
      );
    });

    it('sets none from a service older than one already logged', async () => {
      const onSubmit = show(undefined, {
        ...oilChange,
        history: [
          {
            id: 'later',
            serviceDate: '2026-09-01T00:00:00.000Z',
            odometer: 31_000,
            category: MaintenanceCategory.EngineOil,
          },
        ],
      });

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-01' } });
      fireEvent.change(screen.getByLabelText('Odometer'), { target: { value: '26000' } });
      fireEvent.change(screen.getByLabelText('Total on the bill'), { target: { value: '1800' } });

      expect(screen.getByTestId('next-due')).toHaveTextContent(
        'A later oil change is already logged, so this one sets no reminder.',
      );
      save();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        nextDueDate: undefined,
        nextDueOdometer: undefined,
      });
    });

    it('keeps the next due a record already has', () => {
      show(
        { ...loaded, nextDueDate: '2027-01-15', nextDueOdometer: 25_000 },
        { ...oilChange, fieldsFromBill: new Set<BillField>(['nextDueOdometer']) },
      );

      expect(screen.getByTestId('next-due')).toHaveTextContent(
        '25,000 km or 15 Jan 2027, whichever first. As on the bill.',
      );
    });
  });
});
