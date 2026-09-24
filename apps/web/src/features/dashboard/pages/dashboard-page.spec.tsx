import { fireEvent, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeSummary, makeVehicle } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import type { DashboardSummary } from '../types/dashboard';

const summary = vi.hoisted(() => ({ current: undefined as unknown as DashboardSummary }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock('../hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => ({ isPending: false, isError: false, data: summary.current }),
}));
// Beside the point here, and each reaches for data of its own.
vi.mock('../components/costs-summary-line', () => ({ CostsSummaryLine: () => null }));
vi.mock('@/features/pwa/components/install-app-card', () => ({ InstallAppCard: () => null }));

import { DashboardPage } from './dashboard-page';

function showDashboard(vehicles: ReturnType<typeof makeVehicle>[]) {
  summary.current = makeSummary({
    vehicles,
    vehiclesTotal: vehicles.length,
    totalVehicles: vehicles.length,
  });
  renderWithProviders(<DashboardPage onSearchStateChange={vi.fn()} searchState={{}} />);
}

describe('DashboardPage logging', () => {
  it('logs a service or fuel in one tap each', () => {
    showDashboard([makeVehicle({ id: 'vehicle-1', displayName: 'Swift' })]);

    fireEvent.click(screen.getByRole('button', { name: 'Log service' }));
    expect(screen.getByRole('dialog', { name: 'Log a service' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'Log fuel' }));
    expect(screen.getByRole('dialog', { name: 'Log fuel' })).toBeInTheDocument();
  });

  it('offers a viewer neither', () => {
    showDashboard([makeVehicle({ id: 'vehicle-1', currentUserRole: 'viewer' })]);

    expect(screen.queryByRole('button', { name: 'Log service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log fuel' })).not.toBeInTheDocument();
  });

  it('logs only against the vehicles the user can change', () => {
    showDashboard([
      makeVehicle({ id: 'vehicle-1', displayName: 'Swift' }),
      makeVehicle({
        id: 'vehicle-2',
        displayName: 'Shared bike',
        registrationNumber: 'MH12ZZ0001',
        currentUserRole: 'viewer',
      }),
    ]);

    // The header's, first on the page; the recent-service card has a picker of its own.
    fireEvent.click(screen.getAllByRole('button', { name: 'Log service' })[0]!);

    // Only one vehicle can be logged against, so there is nothing to choose.
    expect(screen.queryByLabelText('Vehicle')).not.toBeInTheDocument();
  });
});
