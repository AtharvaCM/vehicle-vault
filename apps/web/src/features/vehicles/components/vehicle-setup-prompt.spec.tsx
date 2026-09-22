import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleRole, type VehicleDocument } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '../context/vehicle-access';
import { VehicleSetupPrompt } from './vehicle-setup-prompt';

const documentsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const createDocument = vi.hoisted(() => vi.fn());
const dismissPrompt = vi.hoisted(() => vi.fn());

vi.mock('../../vehicle-documents/hooks/use-documents', () => ({
  useVehicleDocuments: () => documentsQuery.current,
  useCreateVehicleDocument: () => ({ mutateAsync: createDocument, isPending: false }),
}));
vi.mock('../hooks/use-dismiss-setup-prompt', () => ({
  useDismissVehicleSetupPrompt: () => ({ mutateAsync: dismissPrompt, isPending: false }),
}));

function insuranceDocument(): VehicleDocument {
  return {
    id: 'doc-1',
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: null,
    number: null,
    startDate: null,
    endDate: new Date('2027-03-01T00:00:00.000Z'),
    notes: null,
    details: {},
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
  };
}

function renderPrompt({
  dismissedAt = null,
  fuelType = FuelType.Petrol,
  role = VehicleRole.Owner,
}: { dismissedAt?: string | null | undefined; fuelType?: FuelType; role?: VehicleRole } = {}) {
  return render(
    <VehicleAccessProvider role={role}>
      <VehicleSetupPrompt dismissedAt={dismissedAt} fuelType={fuelType} vehicleId="vehicle-1" />
    </VehicleAccessProvider>,
  );
}

describe('VehicleSetupPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentsQuery.current = { data: [], isSuccess: true };
    createDocument.mockResolvedValue(undefined);
    dismissPrompt.mockResolvedValue(undefined);
  });

  it('asks for both expiry dates on a vehicle that has neither', () => {
    renderPrompt();

    expect(screen.getByLabelText('Insurance expires on')).toBeInTheDocument();
    expect(screen.getByLabelText('PUC expires on')).toBeInTheDocument();
  });

  it('creates an insurance document from the expiry alone', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await user.type(screen.getByLabelText('Insurance expires on'), '2027-03-01');
    await user.click(screen.getByRole('button', { name: 'Save dates' }));

    await waitFor(() => expect(createDocument).toHaveBeenCalledTimes(1));
    expect(createDocument).toHaveBeenCalledWith({
      kind: 'insurance',
      endDate: new Date('2027-03-01'),
    });
    // Answered counts as put away: the prompt does not come back.
    await waitFor(() => expect(dismissPrompt).toHaveBeenCalled());
  });

  it('creates a PUC document for the other date, and only the dates given', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await user.type(screen.getByLabelText('PUC expires on'), '2026-12-15');
    await user.click(screen.getByRole('button', { name: 'Save dates' }));

    await waitFor(() => expect(createDocument).toHaveBeenCalledTimes(1));
    expect(createDocument).toHaveBeenCalledWith({
      kind: 'puc',
      endDate: new Date('2026-12-15'),
    });
  });

  it('will not save with both fields empty', () => {
    renderPrompt();

    expect(screen.getByRole('button', { name: 'Save dates' })).toBeDisabled();
  });

  it('skips in one click, without creating anything', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(dismissPrompt).toHaveBeenCalledTimes(1));
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('stays out of the way once the prompt has been answered or skipped', () => {
    renderPrompt({ dismissedAt: '2026-09-21T10:00:00.000Z' });

    expect(screen.queryByText('Never miss a renewal')).not.toBeInTheDocument();
  });

  it('stays hidden against an API that predates the prompt and could not save it', () => {
    // The field is omitted, not null: the web can ship before the API does.
    render(
      <VehicleAccessProvider role={VehicleRole.Owner}>
        <VehicleSetupPrompt
          dismissedAt={undefined}
          fuelType={FuelType.Petrol}
          vehicleId="vehicle-1"
        />
      </VehicleAccessProvider>,
    );

    expect(screen.queryByText('Never miss a renewal')).not.toBeInTheDocument();
  });

  it('never shows for a viewer, who could not save it anyway', () => {
    renderPrompt({ role: VehicleRole.Viewer });

    expect(screen.queryByText('Never miss a renewal')).not.toBeInTheDocument();
  });

  it('asks only for the date that is still missing', () => {
    documentsQuery.current = { data: [insuranceDocument()], isSuccess: true };

    renderPrompt();

    expect(screen.queryByLabelText('Insurance expires on')).not.toBeInTheDocument();
    expect(screen.getByLabelText('PUC expires on')).toBeInTheDocument();
  });

  it('asks an electric vehicle for its insurance alone, since it is exempt from PUC', () => {
    renderPrompt({ fuelType: FuelType.Electric });

    expect(screen.getByLabelText('Insurance expires on')).toBeInTheDocument();
    expect(screen.queryByLabelText('PUC expires on')).not.toBeInTheDocument();
    expect(screen.getByText(/Add the expiry date now/)).toBeInTheDocument();
  });

  it('stays out of the way of an electric vehicle with its insurance on file', () => {
    documentsQuery.current = { data: [insuranceDocument()], isSuccess: true };

    renderPrompt({ fuelType: FuelType.Electric });

    expect(screen.queryByText('Never miss a renewal')).not.toBeInTheDocument();
  });

  it('stays hidden while the documents are still loading', () => {
    documentsQuery.current = { data: undefined, isSuccess: false };

    renderPrompt();

    expect(screen.queryByText('Never miss a renewal')).not.toBeInTheDocument();
  });

  it('keeps the dates on screen when saving fails, so the answer is not lost', async () => {
    const user = userEvent.setup();
    createDocument.mockRejectedValue(new Error('Internal server error'));
    renderPrompt();

    await user.type(screen.getByLabelText('PUC expires on'), '2026-12-15');
    await user.click(screen.getByRole('button', { name: 'Save dates' }));

    await waitFor(() => expect(createDocument).toHaveBeenCalled());
    expect(dismissPrompt).not.toHaveBeenCalled();
    expect(screen.getByLabelText('PUC expires on')).toHaveValue('2026-12-15');
  });
});
