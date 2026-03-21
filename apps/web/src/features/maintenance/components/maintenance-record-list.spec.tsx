import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { MaintenanceCategory } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { MaintenanceRecordList } from './maintenance-record-list';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const record = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  serviceDate: '2026-03-21T00:00:00.000Z',
  odometer: 12000,
  category: MaintenanceCategory.EngineOil,
  workshopName: 'Torque Garage',
  totalCost: 3200,
  notes: 'Changed engine oil',
  createdAt: '2026-03-21T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

describe('MaintenanceRecordList', () => {
  it('renders selection checkboxes and reports selection changes', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <MaintenanceRecordList
        onSelectionChange={onSelectionChange}
        records={[record]}
        selectedRecordIds={[]}
      />,
    );

    await user.click(
      screen.getByRole('checkbox', { name: /select maintenance record torque garage/i }),
    );

    expect(onSelectionChange).toHaveBeenCalledWith('record-1', true);
  });

  it('reflects controlled selection state', () => {
    render(
      <MaintenanceRecordList
        onSelectionChange={vi.fn()}
        records={[record]}
        selectedRecordIds={['record-1']}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /select maintenance record torque garage/i }),
    ).toBeChecked();
  });
});
