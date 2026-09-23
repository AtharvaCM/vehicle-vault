import { screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { FuelType, MaintenanceCategory } from '@vehicle-vault/shared';
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
    expect(screen.getByText('Brake pads · 3 days late')).toBeInTheDocument();
  });

  it('names the EMI behind a due soon pill, with its amount', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          status: 'due_soon',
          dueSoonCount: 1,
          nextDue: {
            kind: 'loan_emi',
            targetId: 'emi:loan-1',
            title: 'Loan EMI',
            amount: 4800,
            dueDate: '2026-04-04T00:00:00.000Z',
            daysUntilDue: 2,
          },
        })}
      />,
    );

    const pill = screen.getByRole('link', { name: '1 due soon' });

    expect(pill).toHaveAttribute('data-search', JSON.stringify({ tab: 'loans' }));
    expect(screen.getByText(/^EMI ₹4,800 · /)).toBeInTheDocument();
    expect(screen.queryByText('Nothing scheduled')).not.toBeInTheDocument();
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
    expect(screen.getByText('Insurance policy · 5 days left')).toBeInTheDocument();
  });

  it('points the pill at the tyres tab when a worn tyre is what is overdue', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          status: 'overdue',
          overdueCount: 1,
          nextDue: {
            kind: 'tyre',
            targetId: 'tyre:fl',
            title: 'Replace tyre',
            dueDate: null,
            daysUntilDue: null,
          },
        })}
      />,
    );

    expect(screen.getByRole('link', { name: '1 overdue' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'tyres' }),
    );
    expect(screen.getByText('Replace tyre')).toBeInTheDocument();
  });

  describe('data score', () => {
    it('reads as complete, with nothing to nag about, when everything is on file', () => {
      renderWithProviders(
        <VehicleHealthCard
          today={today}
          vehicle={makeVehicle({ dataHealth: { score: 100, nextGap: null } })}
        />,
      );

      expect(screen.getByText('Data')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('names the gap worth filling, linked to where it is filled', () => {
      renderWithProviders(
        <VehicleHealthCard
          today={today}
          vehicle={makeVehicle({ dataHealth: { score: 70, nextGap: 'insurance' } })}
        />,
      );

      expect(screen.getByText('70%')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'No current insurance' })).toHaveAttribute(
        'data-search',
        JSON.stringify({ tab: 'protection' }),
      );
    });

    it('sends a missing catalog link or purchase price to the edit form', () => {
      renderWithProviders(
        <VehicleHealthCard
          today={today}
          vehicle={makeVehicle({ dataHealth: { score: 85, nextGap: 'catalog_link' } })}
        />,
      );

      expect(screen.getByRole('link', { name: 'Not linked to a catalog model' })).toHaveAttribute(
        'href',
        '/vehicles/$vehicleId/edit',
      );
    });

    it('leaves a stale odometer to the Update control already on the card', () => {
      renderWithProviders(
        <VehicleHealthCard
          today={today}
          vehicle={makeVehicle({ dataHealth: { score: 80, nextGap: 'odometer' } })}
        />,
      );

      expect(screen.getByText('Odometer not updated lately')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Odometer not updated lately' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Update odometer for Daily driver' }),
      ).toBeInTheDocument();
    });

    it('tells a viewer the gap without offering to fill it', () => {
      renderWithProviders(
        <VehicleHealthCard
          today={today}
          vehicle={makeVehicle({
            currentUserRole: 'viewer',
            dataHealth: { score: 70, nextGap: 'insurance' },
          })}
        />,
      );

      expect(screen.getByText('No current insurance')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'No current insurance' })).not.toBeInTheDocument();
    });

    it('leaves the row out when the API does not send a score yet', () => {
      renderWithProviders(<VehicleHealthCard today={today} vehicle={makeVehicle()} />);

      expect(screen.queryByText('Data')).not.toBeInTheDocument();
    });
  });

  it('shows All clear and Nothing scheduled for a healthy vehicle', () => {
    renderWithProviders(<VehicleHealthCard today={today} vehicle={makeVehicle()} />);

    expect(screen.getByRole('link', { name: 'All clear' })).toBeInTheDocument();
    expect(screen.getByText('Nothing scheduled')).toBeInTheDocument();
    expect(screen.getByText('Insurance & PUC valid · to 15 Sep 2026')).toBeInTheDocument();
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
        'PUC · Ended 23 Mar',
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
        'Insurance · 8 days left',
      ],
      [
        {
          insurance: { state: 'active', endDate: '2026-12-01T00:00:00.000Z' },
          puc: { state: 'active', endDate: null },
        },
        'Insurance & PUC valid · to 1 Dec 2026',
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

  it('does not ask an electric vehicle for a PUC, which it is exempt from', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({
          fuelType: FuelType.Electric,
          documents: { insurance: { state: 'active', endDate: '2026-12-01T00:00:00.000Z' } },
          dataHealth: { score: 100, nextGap: null },
        })}
      />,
    );

    expect(screen.getByText('Insurance valid · to 1 Dec 2026')).toBeInTheDocument();
    expect(screen.queryByText('No PUC on file')).not.toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
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

  it('nudges to update a stale odometer, right there on the card', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({ odometerUpdatedAt: '2026-03-20T00:00:00.000Z' })}
      />,
    );

    expect(screen.getByText(/Updated 1 week ago/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update odometer for Daily driver' }),
    ).toBeInTheDocument();
  });

  it('shows "today" right after the odometer is touched', () => {
    renderWithProviders(
      <VehicleHealthCard
        today={today}
        vehicle={makeVehicle({ odometerUpdatedAt: today.toISOString() })}
      />,
    );

    expect(screen.getByText(/Updated today/)).toBeInTheDocument();
  });

  it('hides the write actions for viewers but keeps the shared badge and menu', () => {
    renderWithProviders(
      <VehicleHealthCard today={today} vehicle={makeVehicle({ currentUserRole: 'viewer' })} />,
    );

    expect(screen.queryByRole('link', { name: /log service for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add reminder for/i })).not.toBeInTheDocument();
    // A viewer still sees how fresh the reading is, but cannot change it.
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update odometer/i })).not.toBeInTheDocument();
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
