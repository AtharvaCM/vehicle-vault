import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
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
vi.mock('@/features/maintenance/components/vehicle-maintenance-list', () => ({
  VehicleMaintenanceList: () => <div data-testid="vehicle-maintenance-list" />,
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

describe('VehicleHistoryTab', () => {
  it('shows the service content and not the fuel tab in the service view', () => {
    render(
      <VehicleHistoryTab
        onViewChange={vi.fn()}
        serviceInsights={serviceInsights}
        vehicleId="vehicle-1"
        view="service"
      />,
    );

    expect(screen.getByTestId('service-history-card')).toBeInTheDocument();
    expect(screen.getByTestId('odometer-history-card')).toBeInTheDocument();
    expect(screen.queryByTestId('fuel-tab')).not.toBeInTheDocument();
  });

  it('shows the fuel tab in the fuel view', () => {
    render(
      <VehicleHistoryTab
        onViewChange={vi.fn()}
        serviceInsights={serviceInsights}
        vehicleId="vehicle-1"
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
        onViewChange={onViewChange}
        serviceInsights={serviceInsights}
        vehicleId="vehicle-1"
        view="service"
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Fuel' }));

    expect(onViewChange).toHaveBeenCalledWith('fuel');
  });
});
