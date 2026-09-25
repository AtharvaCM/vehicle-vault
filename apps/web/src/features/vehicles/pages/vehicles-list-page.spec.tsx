import { fireEvent, screen, within } from '@testing-library/react';
import { FuelType, VehicleRole, VehicleType } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeSummary, makeVehicle } from '@/features/dashboard/test/fixtures';
import { renderWithProviders } from '@/features/dashboard/test/render';
import type { DashboardVehicleHealth } from '@/features/dashboard/types/dashboard';

import type { Vehicle } from '../types/vehicle';

const garage = vi.hoisted(() => ({ current: [] as unknown[] }));
const summary = vi.hoisted(() => ({ current: undefined as unknown }));

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
}));
vi.mock('../hooks/use-vehicles', () => ({
  useVehicles: () => ({ isPending: false, isError: false, data: garage.current }),
}));
vi.mock('@/features/dashboard/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => ({ data: summary.current }),
}));

import { VehiclesListPage } from './vehicles-list-page';

function vehicle(id: string, nickname: string, overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    registrationNumber: `MH12AB${id.slice(-4).padStart(4, '0')}`,
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    nickname,
    year: 2023,
    vehicleType: VehicleType.SUV,
    fuelType: FuelType.Petrol,
    odometer: 18_500,
    currentUserRole: VehicleRole.Owner,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function show(vehicles: Vehicle[], health: Partial<DashboardVehicleHealth>[] = [], search = {}) {
  garage.current = vehicles;
  summary.current = makeSummary({
    vehicles: health.map((entry) => makeVehicle(entry)),
  });
  renderWithProviders(<VehiclesListPage onSearchStateChange={vi.fn()} searchState={search} />);
}

const rows = () => screen.getAllByTestId('garage-row');

beforeEach(() => {
  garage.current = [];
});

describe('VehiclesListPage', () => {
  it('lists each vehicle by plate and name, with one status and what it is about', () => {
    show(
      [vehicle('v-0001', 'Family SUV')],
      [
        {
          id: 'v-0001',
          status: 'overdue',
          overdueCount: 1,
          nextDue: {
            kind: 'document',
            targetId: 'doc-1',
            title: 'Insurance renewal',
            dueDate: '2026-09-20T00:00:00.000Z',
            daysUntilDue: -3,
          },
        },
      ],
    );

    const [row] = rows();
    expect(row).toHaveTextContent('MH 12 AB 0001');
    expect(row).toHaveTextContent('Family SUV');
    expect(row).toHaveTextContent('Hyundai Creta SX · 18,500 km');
    expect(row).toHaveTextContent('1 late');
    expect(row).toHaveTextContent('Insurance renewal');
    expect(
      within(row!).getByRole('link', { name: 'Show papers for Family SUV' }),
    ).toBeInTheDocument();
  });

  it('puts the most urgent first and all-clear last', () => {
    show(
      [vehicle('v-0001', 'Clear'), vehicle('v-0002', 'Soon'), vehicle('v-0003', 'Late')],
      [
        { id: 'v-0001', status: 'ok' },
        {
          id: 'v-0002',
          status: 'due_soon',
          dueSoonCount: 1,
          nextDue: {
            kind: 'reminder',
            targetId: 'r-1',
            title: 'Oil change',
            dueDate: '2026-09-27T00:00:00.000Z',
            daysUntilDue: 2,
          },
        },
        { id: 'v-0003', status: 'overdue', overdueCount: 1 },
      ],
    );

    expect(rows().map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Late',
      'Soon',
      'Clear',
    ]);
  });

  it('says a shared vehicle is shared, in plain words', () => {
    show([vehicle('v-0001', 'Second car', { currentUserRole: VehicleRole.Viewer })]);

    expect(rows()[0]).toHaveTextContent('Shared · can view');
  });

  it('offers search only once the garage is longer than six', () => {
    show(Array.from({ length: 6 }, (_, index) => vehicle(`v-000${index}`, `Car ${index}`)));
    expect(screen.queryByRole('searchbox', { name: 'Search vehicles' })).not.toBeInTheDocument();
  });

  it('shows the search for a longer garage', () => {
    show(Array.from({ length: 7 }, (_, index) => vehicle(`v-000${index}`, `Car ${index}`)));
    expect(screen.getByRole('searchbox', { name: 'Search vehicles' })).toBeInTheDocument();
  });

  it('keeps bulk actions behind Select', () => {
    show([vehicle('v-0001', 'One'), vehicle('v-0002', 'Two')]);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Select all visible')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select vehicle One' }));
    expect(screen.getByText('1 vehicle selected')).toBeInTheDocument();
    expect(rows()[0]).toHaveAttribute('data-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('offers no Select for a single vehicle', () => {
    show([vehicle('v-0001', 'Only')]);
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });
});
