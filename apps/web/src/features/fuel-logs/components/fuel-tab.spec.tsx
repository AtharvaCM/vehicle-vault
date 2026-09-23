import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleRole, type FuelLog } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';

const logsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../hooks/use-fuel-logs', () => ({ useFuelLogs: () => logsQuery.current }));
vi.mock('../hooks/use-create-fuel-log', () => ({ useCreateFuelLog: mutation }));
vi.mock('../hooks/use-delete-fuel-log', () => ({ useDeleteFuelLog: mutation }));
vi.mock('../hooks/use-update-fuel-log', () => ({ useUpdateFuelLog: mutation }));
vi.mock('../hooks/use-scan-receipt', () => ({
  useScanReceipt: mutation,
  useScanStatus: () => ({ queryKey: ['scan-status'], queryFn: async () => null }),
}));
vi.mock('./fuel-import-dialog', () => ({ FuelImportDialog: () => null }));
// Partial mock: the component tree still imports queryOptions and friends.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: undefined, isPending: false }),
}));

import { FuelTab } from './fuel-tab';

const log: FuelLog = {
  id: 'fuel-1',
  vehicleId: 'vehicle-1',
  date: '2026-09-01T00:00:00.000Z',
  odometer: 40_000,
  quantity: 8,
  price: 105,
  totalCost: 840,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function renderAs(role: VehicleRole, logs: FuelLog[]) {
  logsQuery.current = { data: logs, isLoading: false, isError: false };

  return render(
    <VehicleAccessProvider role={role}>
      <FuelTab vehicleId="vehicle-1" />
    </VehicleAccessProvider>,
  );
}

describe('FuelTab roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s log, scan and import', (role) => {
    renderAs(role, []);

    expect(screen.getByRole('button', { name: /log fuel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan receipt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add fuel log/i })).toBeInTheDocument();
  });

  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'lets an %s edit and delete a fill',
    async (role) => {
      const user = userEvent.setup();
      renderAs(role, [log]);

      await user.click(screen.getByRole('button', { name: 'Fuel log actions' }));

      expect(await screen.findByRole('menuitem', { name: 'Edit entry' })).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Delete entry' })).toBeVisible();
    },
  );

  it('shows a viewer the fills without any way to change them', () => {
    renderAs(VehicleRole.Viewer, [log]);

    expect(screen.getByText('8 L fuel fill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fuel log actions' })).not.toBeInTheDocument();
    for (const name of [/log fuel/i, /scan receipt/i, /import csv/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('gives a viewer an empty history without an add prompt', () => {
    renderAs(VehicleRole.Viewer, []);

    expect(screen.getByText('No fuel logs found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add fuel log/i })).not.toBeInTheDocument();
  });
});
