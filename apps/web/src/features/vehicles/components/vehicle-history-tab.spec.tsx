import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { FuelType, VehicleRole } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/features/service-baseline/components/service-history-card', () => ({
  ServiceHistoryCard: () => <div data-testid="service-history-card" />,
}));
vi.mock('@/features/fuel-logs/components/fuel-tab', () => ({
  FuelTab: () => <div data-testid="fuel-tab" />,
}));
vi.mock('@/features/fuel-logs/components/fuel-economy-card', () => ({
  FuelEconomyCard: () => <div data-testid="fuel-economy-card" />,
}));
vi.mock('./vehicle-service-history', () => ({
  VehicleServiceHistory: ({ search }: { search?: string }) => (
    <div data-search={search} data-testid="vehicle-service-history" />
  ),
}));
vi.mock('./odometer-history-card', () => ({
  OdometerHistoryCard: () => <div data-testid="odometer-history-card" />,
}));

import { VehicleHistoryTab } from './vehicle-history-tab';

const serviceInsights = {
  averageDaysBetweenServices: null,
  averageKmBetweenServices: null,
  averageSpend: null,
  history: [],
  kmSinceLastService: null,
  latestService: null,
  nextDueDateDeltaDays: null,
  nextDueOdometerDelta: null,
};

const vehicle = {
  id: 'vehicle-1',
  nickname: 'Daily',
  make: 'Hyundai',
  model: 'Creta',
  registrationNumber: 'MH12AB1234',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

describe('VehicleHistoryTab', () => {
  it('shows the service content and not the fuel tab in the service view', () => {
    render(
      <VehicleHistoryTab
        fuelType={FuelType.Petrol}
        odometer={40_000}
        onViewChange={vi.fn()}
        onSearchChange={vi.fn()}
        search={undefined}
        serviceInsights={serviceInsights}
        vehicle={vehicle}
        view="service"
      />,
    );

    expect(screen.getByTestId('service-history-card')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-service-history')).toBeInTheDocument();
    expect(screen.getByTestId('odometer-history-card')).toBeInTheDocument();
    expect(screen.queryByTestId('fuel-tab')).not.toBeInTheDocument();
  });

  it('shows the fuel tab in the fuel view', () => {
    render(
      <VehicleHistoryTab
        fuelType={FuelType.Petrol}
        odometer={40_000}
        onViewChange={vi.fn()}
        onSearchChange={vi.fn()}
        search={undefined}
        serviceInsights={serviceInsights}
        vehicle={vehicle}
        view="fuel"
      />,
    );

    expect(screen.getByTestId('fuel-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('service-history-card')).not.toBeInTheDocument();
  });

  it('calls onViewChange with "fuel" when the Fuel control is clicked', async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(
      <VehicleHistoryTab
        fuelType={FuelType.Petrol}
        odometer={40_000}
        onViewChange={onViewChange}
        onSearchChange={vi.fn()}
        search={undefined}
        serviceInsights={serviceInsights}
        vehicle={vehicle}
        view="service"
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Fuel' }));

    expect(onViewChange).toHaveBeenCalledWith('fuel');
  });
});
