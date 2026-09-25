import { fireEvent, render, screen } from '@testing-library/react';
import { FuelType, VehicleRole, type HistoryPage } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const historyQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const useHistoryMock = vi.hoisted(() => vi.fn((..._args: unknown[]) => historyQuery.current));

vi.mock('@/features/history/hooks/use-history', () => ({ useHistory: useHistoryMock }));
vi.mock('@/features/history/components/history-timeline', () => ({
  HistoryTimeline: () => <div data-testid="history-timeline" />,
}));
vi.mock('@/features/accessories/components/accessory-form-dialog', () => ({
  AccessoryFormDialog: () => <div role="dialog" aria-label="Add an accessory" />,
}));

import { VehicleAccessProvider } from '../context/vehicle-access';
import { VehicleAccessoryHistory } from './vehicle-accessory-history';

const vehicle = {
  id: 'vehicle-1',
  nickname: 'Daily',
  make: 'Hyundai',
  model: 'Creta',
  registrationNumber: 'MH12AB1234',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

function settle(entries: HistoryPage['entries']) {
  historyQuery.current = {
    data: { pages: [{ entries, months: [], draftCount: 0, nextCursor: null }] },
    isPending: false,
    isError: false,
  };
}

function renderAs(role: VehicleRole, search?: string) {
  return render(
    <VehicleAccessProvider role={role}>
      <VehicleAccessoryHistory onSearchChange={vi.fn()} search={search} vehicle={vehicle} />
    </VehicleAccessProvider>,
  );
}

describe('VehicleAccessoryHistory', () => {
  beforeEach(() => settle([]));

  it("asks History for this vehicle's accessories", () => {
    renderAs(VehicleRole.Owner, 'dash');

    expect(useHistoryMock).toHaveBeenLastCalledWith({
      vehicleId: 'vehicle-1',
      kind: 'accessory',
      search: 'dash',
    });
  });

  it('offers an editor Add accessory from the empty state, and opens it', async () => {
    renderAs(VehicleRole.Editor);

    expect(screen.getByText('No accessories yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add accessory' }));
    expect(await screen.findByRole('dialog', { name: 'Add an accessory' })).toBeInTheDocument();
  });

  it('gives a viewer the list and no Add', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByText('No accessories yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add accessory' })).not.toBeInTheDocument();
  });
});
