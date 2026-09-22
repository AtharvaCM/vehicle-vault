import { screen, within } from '@testing-library/react';
import { MaintenanceCategory, MaintenanceRecordStatus } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/render';
import type { DashboardMaintenanceSummary } from '../types/dashboard';
import { RecentServiceCard } from './recent-service-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function makeSummary(
  overrides: Partial<DashboardMaintenanceSummary> = {},
): DashboardMaintenanceSummary {
  return {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    vehicleLabel: 'Daily driver • MH12AB1234',
    category: MaintenanceCategory.EngineOil,
    serviceDate: '2026-03-21T00:00:00.000Z',
    totalCost: 3_200,
    workshopName: 'Torque Garage',
    attachmentCount: 0,
    ...overrides,
  };
}

describe('RecentServiceCard', () => {
  it('marks a draft so it does not read as a logged service', () => {
    renderWithProviders(
      <RecentServiceCard
        recentMaintenance={[
          makeSummary({ id: 'draft', status: MaintenanceRecordStatus.Draft }),
          makeSummary({
            id: 'logged',
            category: MaintenanceCategory.Battery,
            status: MaintenanceRecordStatus.Confirmed,
          }),
          // From an API that predates the field: a confirmed record.
          makeSummary({ id: 'older', category: MaintenanceCategory.TyreReplacement }),
        ]}
        vehicles={[]}
      />,
    );

    const [draftRow, loggedRow, olderRow] = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/maintenance-records/$recordId');

    expect(within(draftRow!).getByText('Draft')).toBeInTheDocument();
    expect(within(loggedRow!).queryByText('Draft')).not.toBeInTheDocument();
    expect(within(olderRow!).queryByText('Draft')).not.toBeInTheDocument();
  });
});
