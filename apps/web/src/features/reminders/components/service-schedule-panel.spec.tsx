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

describe('ServiceSchedulePanel anchors', () => {
  function renderWith(item: Record<string, unknown>) {
    suggestionsQuery.current = {
      data: [{ ...suggestion, ...item }],
      isLoading: false,
      isError: false,
    };

    return render(
      <VehicleAccessProvider role={VehicleRole.Owner}>
        <ServiceSchedulePanel vehicleId="vehicle-1" />
      </VehicleAccessProvider>,
    );
  }

  it('says which logged service the next due is counted from', () => {
    renderWith({
      dueOdometer: 27_500,
      dueDate: '2027-07-25T00:00:00.000Z',
      anchor: {
        source: 'record',
        lastDoneOdometer: 17_500,
        lastDoneDate: '2026-07-25T00:00:00.000Z',
      },
    });

    expect(screen.getByText(/^Last done .+ at 17,500 km → next 27,500 km \/ /)).toBeInTheDocument();
    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument();
  });

  it('says when an item with no history is counted from today', () => {
    renderWith({ anchor: { source: 'now' } });

    expect(
      screen.getByText(/^No history — counted from today → next 50,000 km \/ /),
    ).toBeInTheDocument();
  });

  it('keeps the old line for an API that sends no anchor', () => {
    renderWith({});

    expect(screen.getByText(/Next: 50,000 km/)).toBeInTheDocument();
  });
});
