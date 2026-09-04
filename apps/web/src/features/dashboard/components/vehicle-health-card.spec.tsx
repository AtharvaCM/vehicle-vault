import { screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { MaintenanceCategory } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { makeVehicle } from '../test/fixtures';
import type { DashboardVehicleHealth } from '../types/dashboard';
import { renderWithProviders } from '../test/render';
import { VehicleHealthCard } from './vehicle-health-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to?: string;
  }) => (
    <a data-search={search ? JSON.stringify(search) : undefined} href={to} {...props}>
      {children}
    </a>
  ),
}));

const today = new Date('2026-04-02T09:00:00.000Z');

describe('VehicleHealthCard', () => {
  it('shows the overdue pill linking to the reminders tab', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          status: 'overdue',
          overdueCount: 2,
          dueSoonCount: 1,
          nextDue: {
            kind: 'reminder',
            targetId: 'reminder-1',
            title: 'Brake pads',
            dueDate: '2026-03-30T00:00:00.000Z',
            daysUntilDue: -3,
          },
        })}
      />,
    );

    const pill = screen.getByRole('link', { name: '2 overdue' });

    expect(pill).toHaveAttribute('data-search', JSON.stringify({ tab: 'reminders' }));
    expect(screen.getByText('Brake pads · 3 days overdue')).toBeInTheDocument();
  });

  it('shows the due soon pill linking to protection when a document is next', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          status: 'due_soon',
          dueSoonCount: 1,
          nextDue: {
            kind: 'document',
            targetId: 'doc-1',
            title: 'Insurance policy',
            dueDate: '2026-04-07T00:00:00.000Z',
            daysUntilDue: 5,
          },
        })}
      />,
    );

    expect(screen.getByRole('link', { name: '1 due soon' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'protection' }),
    );
    expect(screen.getByText('Insurance policy · Expires in 5 days')).toBeInTheDocument();
  });

  it('shows All clear and Nothing scheduled for a healthy vehicle', () => {
    renderWithProviders(<VehicleHealthCard today={today} vehicle={makeVehicle()} />);

    expect(screen.getByRole('link', { name: 'All clear' })).toBeInTheDocument();
    expect(screen.getByText('Nothing scheduled')).toBeInTheDocument();
    expect(screen.getByText('Insurance & PUC valid · to 15 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText('No service logged')).toBeInTheDocument();
  });

  it('applies the documents precedence: expired > missing insurance > missing PUC > expiring > valid', () => {
    const cases: Array<[DashboardVehicleHealth['documents'], string]> = [
      [
        {
          insurance: { state: 'missing', endDate: null },
          puc: { state: 'expired', endDate: '2026-03-23T00:00:00.000Z' },
          registration: { state: 'expiring', endDate: '2026-04-10T00:00:00.000Z' },
        },
        'PUC expired 10 days ago',
      ],
      [
        {
          insurance: { state: 'missing', endDate: null },
          puc: { state: 'missing', endDate: null },
          road_tax: { state: 'expiring', endDate: '2026-04-10T00:00:00.000Z' },
        },
        'No insurance on file',
      ],
      [
        {
          insurance: { state: 'expiring', endDate: '2026-04-10T00:00:00.000Z' },
          puc: { state: 'missing', endDate: null },
        },
        'No PUC on file',
      ],
      [
        {
          insurance: { state: 'expiring', endDate: '2026-04-10T00:00:00.000Z' },
          puc: { state: 'active', endDate: '2026-09-15T00:00:00.000Z' },
        },
        'Insurance expires in 8 days',
      ],
      [
        {
          insurance: { state: 'active', endDate: '2026-12-01T00:00:00.000Z' },
          puc: { state: 'active', endDate: null },
        },
        'Insurance & PUC valid · to 01 Dec 2026',
      ],
    ];

    for (const [documents, expected] of cases) {
      const { unmount } = renderWithProviders(
        <VehicleHealthCard today={today} vehicle={makeVehicle({ documents })} />,
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders the last service with distance since', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          odometer: 46000,
          lastService: {
            recordId: 'record-1',
            serviceDate: '2026-01-15T00:00:00.000Z',
            odometer: 44200,
            category: MaintenanceCategory.PeriodicService,
          },
        })}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Serviced 15 Jan 2026 · 1,800 km ago' }),
    ).toHaveAttribute('href', '/maintenance-records/$recordId');
  });

  it('nudges to update a stale odometer, linking to the edit page', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({ odometerUpdatedAt: '2026-03-20T00:00:00.000Z' })}
      />,
    );

    expect(screen.getByRole('link', { name: 'Updated 1 week ago · Update' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/edit',
    );
  });

  it('shows "today" right after the odometer is touched', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({ odometerUpdatedAt: today.toISOString() })}
      />,
    );

    expect(screen.getByRole('link', { name: 'Updated today · Update' })).toBeInTheDocument();
  });

  it('hides the write actions for viewers but keeps the shared badge and menu', () => {
    renderWithProviders(
      <VehicleHealthCard today={today} vehicle={makeVehicle({ currentUserRole: 'viewer' })} />,
    );

    expect(screen.queryByRole('link', { name: /log service for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add reminder for/i })).not.toBeInTheDocument();
    expect(screen.getByText('Shared · viewer')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'More actions for Daily driver' }),
    ).toBeInTheDocument();
  });

  it('shows the write actions for owners', () => {
    renderWithProviders(<VehicleHealthCard today={today} vehicle={makeVehicle()} />);

    expect(screen.getByRole('link', { name: 'Log service for Daily driver' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/maintenance/new',
    );
    expect(screen.getByRole('link', { name: 'Add reminder for Daily driver' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/reminders/new',
    );
    expect(screen.queryByText(/shared/i)).not.toBeInTheDocument();
  });
});
