import { fireEvent, render, screen } from '@testing-library/react';
import {
  MaintenanceCategory,
  ServiceBaselineStatus,
  VehicleRole,
  type VehicleServiceBaselineCoverage,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const coverageQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const upsert = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('../hooks/use-service-baseline', () => ({
  useServiceBaselineCoverage: () => coverageQuery.current,
  useUpsertServiceBaseline: () => upsert,
}));

import { VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';

import { ServiceHistoryCard } from './service-history-card';

/** The reported case: a used NS 200 at 40 000 km whose history nobody recorded. */
const coverage: VehicleServiceBaselineCoverage = {
  vehicleId: 'vehicle-1',
  entries: [
    {
      category: MaintenanceCategory.EngineOil,
      source: 'record',
      lastDoneOdometer: 38_000,
      lastDoneDate: '2026-06-01T00:00:00.000Z',
      baseline: null,
    },
    {
      category: MaintenanceCategory.BrakePads,
      source: 'unset',
      lastDoneOdometer: null,
      lastDoneDate: null,
      baseline: null,
    },
  ],
  unansweredCount: 1,
};

function setCoverage(data: VehicleServiceBaselineCoverage) {
  coverageQuery.current = { data, isPending: false, isError: false };
}

describe('ServiceHistoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.isPending = false;
    upsert.mutateAsync.mockResolvedValue([]);
    setCoverage(coverage);
  });

  it('says how much of the history is still missing', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    expect(screen.getByText('1 unanswered')).toBeInTheDocument();
  });

  it('admits what the app assumes when a category has nothing on file', () => {
    // The sentence that makes the silence correctable: a user cannot fix a
    // guess that is never shown to them.
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/assumes it had just been done/i)).toBeInTheDocument();
  });

  it('shows a logged service as settled rather than as a question', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/Logged service at 38,000 km/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Engine Oil last done/i)).not.toBeInTheDocument();
  });

  it('has nothing to save until something is answered', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    expect(screen.getByText('No changes to save')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save history/i })).toBeDisabled();
  });

  it('sends a typed reading for the unanswered category', async () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    fireEvent.change(screen.getByLabelText(/Brake Pads last done at odometer/i), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save history/i }));

    expect(upsert.mutateAsync).toHaveBeenCalledWith({
      entries: [
        {
          category: MaintenanceCategory.BrakePads,
          status: ServiceBaselineStatus.Known,
          lastDoneOdometer: 5_000,
        },
      ],
    });
  });

  it('treats "don’t know" as an answer, not as leaving it blank', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    fireEvent.click(screen.getByRole('button', { name: /don’t know/i }));
    fireEvent.click(screen.getByRole('button', { name: /save history/i }));

    expect(upsert.mutateAsync).toHaveBeenCalledWith({
      entries: [{ category: MaintenanceCategory.BrakePads, status: ServiceBaselineStatus.Unknown }],
    });
  });

  it('clears the reading when the category is marked unknown', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    const input = screen.getByLabelText(/Brake Pads last done at odometer/i);
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /don’t know/i }));

    expect(input).toBeDisabled();
    expect(input).toHaveValue('');
  });

  it('lets an unknown be taken back without inventing a figure', () => {
    render(<ServiceHistoryCard vehicleId="vehicle-1" />);

    const unknownButton = screen.getByRole('button', { name: /don’t know/i });
    fireEvent.click(unknownButton);
    fireEvent.click(unknownButton);

    expect(screen.getByText('No changes to save')).toBeInTheDocument();
  });
});

describe('ServiceHistoryCard for someone who cannot edit the vehicle', () => {
  const answered: VehicleServiceBaselineCoverage = {
    ...coverage,
    entries: [
      ...coverage.entries,
      {
        category: MaintenanceCategory.AirFilter,
        source: 'baseline',
        lastDoneOdometer: 30_000,
        lastDoneDate: null,
        baseline: null,
      },
      {
        category: MaintenanceCategory.Coolant,
        source: 'declared-unknown',
        lastDoneOdometer: null,
        lastDoneDate: null,
        baseline: null,
      },
    ],
  };

  function renderAs(role: VehicleRole) {
    return render(
      <VehicleAccessProvider role={role}>
        <ServiceHistoryCard vehicleId="vehicle-1" />
      </VehicleAccessProvider>,
    );
  }

  beforeEach(() => {
    setCoverage(answered);
  });

  it('shows a viewer the answers instead of the form', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByText(/Logged service at 38,000 km/)).toBeInTheDocument();
    expect(screen.getByText('Not answered yet')).toBeInTheDocument();
    expect(screen.getByText('Last done at 30,000 km')).toBeInTheDocument();
    expect(screen.getByText('Marked as not known')).toBeInTheDocument();
    expect(screen.queryByLabelText(/last done at odometer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /don’t know/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save history/i })).not.toBeInTheDocument();
  });

  it('keeps the form for an editor', () => {
    renderAs(VehicleRole.Editor);

    expect(screen.getByLabelText(/Brake Pads last done at odometer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save history/i })).toBeInTheDocument();
  });
});
