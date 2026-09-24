import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleRole,
  type HistoryFuelEntry,
  type HistoryOdometerEntry,
  type HistoryServiceEntry,
} from '@vehicle-vault/shared';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to: string;
  }) => (
    <a
      data-params={params ? JSON.stringify(params) : undefined}
      data-search={search ? JSON.stringify(search) : undefined}
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
}));

import { HistoryRow, type HistoryVehicle } from './history-row';

const vehicle: HistoryVehicle = {
  id: 'vehicle-1',
  nickname: 'Daily',
  make: 'Hyundai',
  model: 'Creta',
  registrationNumber: 'MH12AB1234',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

const confirmedService: HistoryServiceEntry = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  occurredAt: '2026-09-15T00:00:00.000Z',
  month: '2026-09',
  kind: 'service',
  category: MaintenanceCategory.EngineOil,
  status: MaintenanceRecordStatus.Confirmed,
  workshopName: 'Torque Garage',
  odometer: 18_000,
  totalCost: '4200',
  currencyCode: 'INR',
};

const draftService: HistoryServiceEntry = {
  ...confirmedService,
  id: 'record-2',
  status: MaintenanceRecordStatus.Draft,
};

const fuelEntry: HistoryFuelEntry = {
  id: 'fuel-1',
  vehicleId: 'vehicle-1',
  occurredAt: '2026-09-10T00:00:00.000Z',
  month: '2026-09',
  kind: 'fuel',
  quantity: 30.5,
  location: 'HP Petrol Pump',
  odometer: 17_800,
  totalCost: '3000',
};

const odometerUp: HistoryOdometerEntry = {
  id: 'odo-1',
  vehicleId: 'vehicle-1',
  occurredAt: '2026-09-05T00:00:00.000Z',
  month: '2026-09',
  kind: 'odometer',
  odometer: 18_000,
  previousOdometer: 17_400,
};

const odometerCorrected: HistoryOdometerEntry = {
  ...odometerUp,
  id: 'odo-2',
  odometer: 17_000,
};

describe('HistoryRow service entries', () => {
  it('shows the category, workshop, odometer and amount, linking to the record', () => {
    render(<HistoryRow entry={confirmedService} showVehicle={false} vehicle={vehicle} />);

    expect(screen.getByText('Engine oil')).toBeInTheDocument();
    expect(screen.getByText(/Torque Garage/)).toBeInTheDocument();
    expect(screen.getByText(/18,000 km/)).toBeInTheDocument();
    expect(screen.getByText('₹4,200')).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/maintenance-records/$recordId');
    expect(link).toHaveAttribute('data-params', JSON.stringify({ recordId: confirmedService.id }));
  });

  it('marks a draft and offers an owner a way to confirm it', () => {
    render(<HistoryRow entry={draftService} showVehicle={false} vehicle={vehicle} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    const review = screen.getByRole('link', { name: 'Review and confirm' });
    expect(review).toHaveAttribute('href', '/maintenance-records/$recordId/edit');
    expect(review).toHaveAttribute('data-params', JSON.stringify({ recordId: draftService.id }));
  });

  it('offers an editor the same way to confirm it', () => {
    render(
      <HistoryRow
        entry={draftService}
        showVehicle={false}
        vehicle={{ ...vehicle, currentUserRole: VehicleRole.Editor }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Review and confirm' })).toBeInTheDocument();
  });

  it('tells a viewer who can confirm it, without offering to', () => {
    render(
      <HistoryRow
        entry={draftService}
        showVehicle={false}
        vehicle={{ ...vehicle, currentUserRole: VehicleRole.Viewer }}
      />,
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText(/until an owner or editor confirms it/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review and confirm' })).not.toBeInTheDocument();
  });
});

describe('HistoryRow fuel entries', () => {
  it('titles the quantity and links to the vehicle history, fuel tab', () => {
    render(<HistoryRow entry={fuelEntry} showVehicle={false} vehicle={vehicle} />);

    expect(screen.getByText('Fuel, 30.5 L')).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/vehicles/$vehicleId');
    expect(link).toHaveAttribute('data-params', JSON.stringify({ vehicleId: fuelEntry.vehicleId }));
    expect(link).toHaveAttribute('data-search', JSON.stringify({ tab: 'history', view: 'fuel' }));
  });
});

describe('HistoryRow odometer entries', () => {
  it('shows the reading and the increase from the previous one', () => {
    render(<HistoryRow entry={odometerUp} showVehicle={false} vehicle={vehicle} />);

    expect(screen.getByText('Odometer at 18,000 km')).toBeInTheDocument();
    expect(screen.getByText(/Up 600 km from 17,400 km/)).toBeInTheDocument();
  });

  it('calls a lower reading a correction instead of an increase', () => {
    render(<HistoryRow entry={odometerCorrected} showVehicle={false} vehicle={vehicle} />);

    expect(screen.getByText('Odometer at 17,000 km')).toBeInTheDocument();
    expect(screen.getByText(/Corrected from 17,400 km/)).toBeInTheDocument();
  });
});

describe('HistoryRow plate visibility', () => {
  it('shows the plate only when showVehicle is on', () => {
    const { container, rerender } = render(
      <HistoryRow entry={confirmedService} showVehicle={false} vehicle={vehicle} />,
    );
    expect(container.querySelector('[data-slot="number-plate"]')).not.toBeInTheDocument();

    rerender(<HistoryRow entry={confirmedService} showVehicle vehicle={vehicle} />);
    expect(container.querySelector('[data-slot="number-plate"]')).toBeInTheDocument();
  });
});
