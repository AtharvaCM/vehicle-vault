import { render, screen, within } from '@testing-library/react';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { MaintenanceReceipt } from './maintenance-receipt';

function record(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    serviceDate: '2026-07-25T00:00:00.000Z',
    odometer: 17_500,
    category: MaintenanceCategory.EngineOil,
    workshopName: 'City Hyundai Service',
    totalCost: 4_200,
    currencyCode: 'INR',
    status: MaintenanceRecordStatus.Confirmed,
    source: MaintenanceSource.Manual,
    createdAt: '2026-09-23T10:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
    ...overrides,
  } as MaintenanceRecord;
}

describe('MaintenanceReceipt', () => {
  it('leads with the total, then when, at what reading and where', () => {
    render(<MaintenanceReceipt record={record()} />);

    expect(screen.getByTestId('receipt-total')).toHaveTextContent('₹4,200');
    expect(screen.getByText('25 Jul 2026 · 17,500 km · City Hyundai Service')).toBeInTheDocument();
  });

  it('names the next due and the reminder it set, on a confirmed record only', () => {
    const { unmount } = render(
      <MaintenanceReceipt
        record={record({ nextDueDate: '2027-07-25T00:00:00.000Z', nextDueOdometer: 27_500 })}
      />,
    );
    expect(screen.getByTestId('receipt-next-due')).toHaveTextContent(
      'Next due 25 Jul 2027 or 27,500 km → reminder set',
    );
    unmount();

    render(
      <MaintenanceReceipt
        record={record({ nextDueOdometer: 27_500, status: MaintenanceRecordStatus.Draft })}
      />,
    );
    expect(screen.getByTestId('receipt-next-due')).toHaveTextContent('Next due 27,500 km');
    expect(screen.getByTestId('receipt-next-due')).not.toHaveTextContent('reminder set');
  });

  it('itemises the lines, then labour and tax, a discount taken off, and the total', () => {
    render(
      <MaintenanceReceipt
        record={record({
          laborCost: 1_535,
          taxCost: 640,
          discountAmount: 100,
          lineItems: [
            {
              id: 'item-1',
              kind: MaintenanceLineItemKind.Fluid,
              name: 'Engine oil 5W-30',
              brand: 'Shell',
              quantity: 3.5,
              unit: 'L',
              lineTotal: 1_575,
            },
          ],
        } as Partial<MaintenanceRecord>)}
      />,
    );

    const table = screen.getByRole('table', { name: 'Items' });
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => row.textContent);
    expect(rows).toEqual([
      'ItemQtyAmount',
      'Engine oil 5W-30Shell3.5 L₹1,575',
      'Labour₹1,535',
      'Tax₹640',
      'Discount− ₹100',
      'Total₹4,200',
    ]);
  });

  it('has no table when nothing was itemised: the total stands alone', () => {
    render(<MaintenanceReceipt record={record()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says how it was added, and when it was last edited', () => {
    render(
      <MaintenanceReceipt
        record={record({ source: MaintenanceSource.Ocr, updatedAt: '2026-09-24T10:00:00.000Z' })}
      />,
    );
    expect(screen.getByTestId('receipt-provenance')).toHaveTextContent(
      'Read from a bill on 23 Sep 2026 · last edited 24 Sep 2026',
    );
  });
});
