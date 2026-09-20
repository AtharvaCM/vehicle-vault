import { render, screen } from '@testing-library/react';
import { ReminderType, VehicleRole } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';

const suggestionsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

// Partial mock: the component tree still imports queryOptions and friends.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => suggestionsQuery.current,
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { ServiceSchedulePanel } from './service-schedule-panel';

const suggestion = {
  slug: 'engine-oil',
  title: 'Engine oil change',
  type: ReminderType.Service,
  intervalKm: 10_000,
  intervalMonths: 12,
  dueOdometer: 50_000,
  dueDate: '2026-12-01T00:00:00.000Z',
  alreadyScheduled: false,
  notes: null,
};

function renderAs(role: VehicleRole) {
  suggestionsQuery.current = { data: [suggestion], isLoading: false, isError: false };

  return render(
    <VehicleAccessProvider role={role}>
      <ServiceSchedulePanel vehicleId="vehicle-1" />
    </VehicleAccessProvider>,
  );
}

describe('ServiceSchedulePanel roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s apply a suggestion', (role) => {
    renderAs(role);

    expect(screen.getByRole('checkbox', { name: 'Add Engine oil change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add 0 reminders/i })).toBeInTheDocument();
  });

  it('shows a viewer the suggested intervals without a way to add them', () => {
    renderAs(VehicleRole.Viewer);

    // The intervals themselves are worth reading.
    expect(screen.getByText('Engine oil change')).toBeInTheDocument();
    expect(screen.getByText(/every 10,000 km/i)).toBeInTheDocument();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add .* reminder/i })).not.toBeInTheDocument();
  });
});
