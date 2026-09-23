import { render, screen } from '@testing-library/react';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { MaintenanceSummaryCard } from './maintenance-summary-card';

const baseRecord: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  category: MaintenanceCategory.EngineOil,
  serviceDate: '2026-03-18T00:00:00.000Z',
  odometer: 12345,
  currencyCode: 'INR',
  source: MaintenanceSource.Manual,
  status: MaintenanceRecordStatus.Confirmed,
  totalCost: 2000,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
};

describe('MaintenanceSummaryCard', () => {
  it('shows the resolved amount for a line item saved as qty x unit price', () => {
    render(
      <MaintenanceSummaryCard
        record={{
          ...baseRecord,
          lineItems: [
            {
              id: 'item-1',
              maintenanceRecordId: 'record-1',
              kind: MaintenanceLineItemKind.Fluid,
              name: 'Engine oil',
              quantity: 3.5,
              unit: 'L',
              unitPrice: 450,
              lineTotal: 1575,
              position: 0,
              createdAt: '2026-03-18T00:00:00.000Z',
              updatedAt: '2026-03-18T00:00:00.000Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('₹1,575')).toBeInTheDocument();
  });

  it('shows an em dash instead of a fabricated ₹0 when the amount is genuinely unknown', () => {
    // The bug: a line item with no derivable amount rendered as ₹0 even though
    // it was never known to cost nothing.
    render(
      <MaintenanceSummaryCard
        record={{
          ...baseRecord,
          lineItems: [
            {
              id: 'item-1',
              maintenanceRecordId: 'record-1',
              kind: MaintenanceLineItemKind.Job,
              name: 'Inspection',
              position: 0,
              createdAt: '2026-03-18T00:00:00.000Z',
              updatedAt: '2026-03-18T00:00:00.000Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('₹0')).not.toBeInTheDocument();
  });
});
