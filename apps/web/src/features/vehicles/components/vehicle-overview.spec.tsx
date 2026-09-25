import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleRole,
  VehicleType,
  type HistoryEntry,
  type TcoResponse,
  type Vehicle,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAttentionItem, makeSummary, makeVehicle } from '@/features/dashboard/test/fixtures';
import { renderWithProviders } from '@/features/dashboard/test/render';

const summary = vi.hoisted(() => ({ current: undefined as unknown }));
const history = vi.hoisted(() => ({ current: [] as unknown[] }));
const tco = vi.hoisted(() => ({ current: null as unknown }));
const insights = vi.hoisted(() => ({ current: undefined as unknown }));

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
vi.mock('@/features/dashboard/hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => ({ data: summary.current }),
}));
vi.mock('@/features/history/hooks/use-history', () => ({
  useHistory: () => ({ isSuccess: true, data: { pages: [{ entries: history.current }] } }),
}));
vi.mock('@/features/analytics/api/get-tco', () => ({
  tcoQueryOptions: (vehicleId: string) => ({
    queryKey: ['tco', vehicleId],
    queryFn: () => tco.current,
  }),
}));
vi.mock('../hooks/use-vehicle-insights', () => ({
  useVehicleInsights: () => ({ data: insights.current }),
}));
vi.mock('@/features/reminders/hooks/use-complete-reminder', () => ({
  useCompleteReminder: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/dashboard/hooks/use-snooze-document', () => ({
  useSnoozeDocument: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { VehicleOverview } from './vehicle-overview';

const vehicle: Vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Maruti',
  model: 'Swift',
  year: 2023,
  vehicleType: VehicleType.Car,
  fuelType: FuelType.Petrol,
  odometer: 32_000,
  nickname: 'Daily driver',
  currentUserRole: VehicleRole.Owner,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function spend(netSpend: string): TcoResponse {
  return {
    currency: 'INR',
    vehicleId: vehicle.id,
    purchaseDate: null,
    purchasePrice: null,
    purchaseOdometer: 15_000,
    ownershipMonths: 20,
    kmSincePurchase: 17_000,
    totals: {
      maintenance: netSpend,
      fuel: '0.00',
      accessories: '0.00',
      insurance: '0.00',
      insurerReimbursed: '0.00',
      loanInterest: '0.00',
      loanPrincipalPaid: '0.00',
      loanOutstanding: '0.00',
      netSpend,
      tco: null,
    },
    derived: { costPerKm: '8.40', costPerMonth: '2300.00' },
  };
}

function service(id: string, category = MaintenanceCategory.EngineOil): HistoryEntry {
  return {
    kind: 'service',
    id,
    vehicleId: vehicle.id,
    occurredAt: '2026-07-25T00:00:00.000Z',
    month: '2026-07',
    category,
    status: MaintenanceRecordStatus.Confirmed,
    workshopName: null,
    odometer: 17_500,
    totalCost: '4200.00',
    currencyCode: 'INR',
  };
}

beforeEach(() => {
  summary.current = makeSummary({ vehicles: [makeVehicle()] });
  history.current = [service('record-1')];
  tco.current = spend('28236.00');
  insights.current = {
    dataPointsCount: 3,
    averageDailyMileage: 35,
    averageMonthlyMileage: 1_050,
  };
});

describe('VehicleOverview', () => {
  it("shows this vehicle's three most urgent items, and only this vehicle's", async () => {
    summary.current = makeSummary({
      vehicles: [makeVehicle()],
      attention: [
        makeAttentionItem({ id: 'later', title: 'Wheel alignment', urgency: 'this_month' }),
        makeAttentionItem({ id: 'late', title: 'Insurance renewal', urgency: 'overdue' }),
        makeAttentionItem({ id: 'today', title: 'Oil change', urgency: 'today' }),
        makeAttentionItem({ id: 'week', title: 'Chain lube', urgency: 'this_week' }),
        makeAttentionItem({ id: 'other', title: 'Other car', vehicleId: 'vehicle-2' }),
      ],
    });
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const queue = screen
      .getByRole('heading', { name: 'Needs attention' })
      .closest('.overflow-hidden')!;
    const text = (queue as HTMLElement).textContent ?? '';
    expect(text.indexOf('Insurance renewal')).toBeLessThan(text.indexOf('Oil change'));
    expect(text.indexOf('Oil change')).toBeLessThan(text.indexOf('Chain lube'));
    expect(text).not.toContain('Wheel alignment');
    expect(text).not.toContain('Other car');
    expect(
      within(queue as HTMLElement).getByRole('link', { name: 'All reminders' }),
    ).toHaveAttribute('data-search', JSON.stringify({ tab: 'reminders' }));
  });

  it('reads "All clear" when nothing is due', () => {
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.getByText('Nothing due in the next 30 days.')).toBeInTheDocument();
  });

  it('says how the vehicle stands: the reading, its pace, its papers', async () => {
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const card = screen.getByTestId('this-vehicle');
    expect(card).toHaveTextContent('32,000 km');
    expect(card).toHaveTextContent('~1,050 km a month');
    expect(within(card).getByText('Papers')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /update odometer/i })).toBeInTheDocument();
  });

  it('asks for another reading before it guesses a pace', () => {
    insights.current = { dataPointsCount: 1, averageDailyMileage: 0, averageMonthlyMileage: 0 };
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    expect(screen.getByTestId('this-vehicle')).toHaveTextContent('Log another reading');
  });

  it('puts ₹/km and ₹/month first, with the full breakdown on demand', async () => {
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const card = await screen.findByTestId('running-cost');
    expect(card).toHaveTextContent('₹ / km');
    expect(card).toHaveTextContent('spent since you added it');
    expect(within(card).queryByText('Maintenance')).not.toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Full breakdown' }));
    expect(within(card).getByText('Maintenance')).toBeInTheDocument();
  });

  it('leads with the total when neither rate can be worked out yet', async () => {
    tco.current = {
      ...spend('4200.00'),
      purchaseOdometer: null,
      derived: { costPerKm: null, costPerMonth: null },
    };
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const card = await screen.findByTestId('running-cost');
    expect(within(card).getByText('Spent since you added it')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('₹ / km');
  });

  it('lists the last five entries with a way to all of them', async () => {
    history.current = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => service(id));
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const recent = await screen.findByTestId('recent-activity');
    expect(within(recent).getAllByRole('link', { name: /engine oil/i })).toHaveLength(5);
    expect(within(recent).getByRole('link', { name: 'View all' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'history' }),
    );
  });

  it('offers a setup checklist instead of empty cards on a new vehicle', async () => {
    history.current = [];
    tco.current = spend('0.00');
    renderWithProviders(<VehicleOverview canEdit vehicle={vehicle} />);

    const checklist = await screen.findByTestId('setup-checklist');
    expect(
      within(checklist).getByRole('link', { name: 'Log the last service' }),
    ).toBeInTheDocument();
    expect(
      within(checklist).getByRole('link', { name: /Add insurance and PUC dates/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('running-cost')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recent-activity')).not.toBeInTheDocument();
  });

  it('gives a viewer of a new vehicle nothing to fill in', async () => {
    history.current = [];
    tco.current = spend('0.00');
    renderWithProviders(<VehicleOverview canEdit={false} vehicle={vehicle} />);

    const checklist = await screen.findByTestId('setup-checklist');
    expect(checklist).toHaveTextContent('Nothing has been logged for this vehicle yet.');
    expect(within(checklist).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update odometer/i })).not.toBeInTheDocument();
  });
});
